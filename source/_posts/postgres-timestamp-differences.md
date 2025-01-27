---
title: PostgreSQL Timestamp Differences
date: 2025-01-15 22:12:22
tags:
   - postgres
   - tech
---

While working on my [ULID post](/exploring-alternatives-to-uuidv4-enter-ulids.html), I looked into ways to generate ULIDs from a timestamp and came across [geckoboard/pgluid](https://github.com/geckoboard/pgulid) which implements the function in Pl/PgSQL. What really caught my eye was how the [timestamp portion](https://github.com/geckoboard/pgulid/blob/master/pgulid.sql#L34) of the ID was generated.

It uses a native PostgreSQL function named `CLOCK_TIMESTAMP()`. Based on the knowledge I had at the time I'd only ever interacted with two timestamp functions in Postgres which are `NOW()` and `CURRENT_TIMESTAMP` and I mostly did so when setting default values for dates, so this was a really nice find; and down the rabbit hole I went. While I'm still figuring out how and when to use them I figured I'd document my progress in case I get distracted and need to pick up where I left off. If you also find them interesting and want to experiment with them, I'm happy to have exposed them to you.

## Timestamps in Postgres
There are 5 timestamp functions in Postgres:
1. `NOW()`: returns the timestamp when the current transaction started. The value stays constant throughout the entire transaction.
2. `CURRENT_TIMESTAMP`: returns the timestamp when the current transaction started. The value stays constant throughout the entire transaction.
3. `CLOCK_TIMESTAMP()`: returns the actual current time at the point of execution of an SQL query, its value changes within a transaction.
4. `STATEMENT_TIMESTAMP()`: returns the time when the current statement started executing, its value changes within a transaction.
5. `TRANSACTION_TIMESTAMP()`: returns the timestamp when the current transaction started. The value stays constant throughout the entire transaction.

`NOW()`, `CURRENT_TIMESTAMP` and `TRANSACTION_TIMESTAMP()` are actually the same, with `NOW()` and `CURRENT_TIMESTAMP` being more intuitive for regular queries and `TRANSACTION_TIMESTAMP()` being more intuitive when explicitly using transactions. `STATEMENT_TIMESTAMP()` and `TRANSACTION_TIMESTAMP()` return the same value during the first query of a transaction, but might differ for subsequent queries.  

<script id="main.sql" type="text/plain">
\x
##CODE##
</script>

<script id="uuid7.sql" type="text/plain">
/**
 * Returns a time-ordered UUID with Unix Epoch (UUIDv7).
 *
 * Reference: https://www.rfc-editor.org/rfc/rfc9562.html
 * Reference: https://gist.github.com/fabiolimace/515a0440e3e40efeb234e12644a6a346
 *
 * MIT License.
 *
 */
create or replace function uuid7() returns uuid as $$
declare
begin
	return uuid7(clock_timestamp());
end $$ language plpgsql;

create or replace function uuid7(p_timestamp timestamp with time zone) returns uuid as $$
declare

	v_time double precision := null;

	v_unix_t bigint := null;
	v_rand_a bigint := null;
	v_rand_b bigint := null;

	v_unix_t_hex varchar := null;
	v_rand_a_hex varchar := null;
	v_rand_b_hex varchar := null;

	c_milli double precision := 10^3;  -- 1 000
	c_micro double precision := 10^6;  -- 1 000 000
	c_scale double precision := 4.096; -- 4.0 * (1024 / 1000)
	
	c_version bigint := x'0000000000007000'::bigint; -- RFC-9562 version: b'0111...'
	c_variant bigint := x'8000000000000000'::bigint; -- RFC-9562 variant: b'10xx...'

begin

	v_time := extract(epoch from p_timestamp);

	v_unix_t := trunc(v_time * c_milli);
	v_rand_a := trunc((v_time * c_micro - v_unix_t * c_milli) * c_scale);
	-- v_rand_b := secure_random_bigint(); -- use when pgcrypto extension is installed
	v_rand_b := trunc(random() * 2^30)::bigint << 32 | trunc(random() * 2^32)::bigint;

	v_unix_t_hex := lpad(to_hex(v_unix_t), 12, '0');
	v_rand_a_hex := lpad(to_hex((v_rand_a | c_version)::bigint), 4, '0');
	v_rand_b_hex := lpad(to_hex((v_rand_b | c_variant)::bigint), 16, '0');

	return (v_unix_t_hex || v_rand_a_hex || v_rand_b_hex)::uuid;
	
end $$ language plpgsql;

##CODE##
</script>

## Testing it out

### Outside a transaction
When run in the same query `NOW()`, it's variants and `STATEMENT_TIMESTAMP()` return the same value, and we don't really get to appreciate the differences between them. The value of `CLOCK_TIMESTAMP()` would always be different from the other two.  
<pre><code class="lang-sql">select
NOW(),
CURRENT_TIMESTAMP,
STATEMENT_TIMESTAMP(),
CLOCK_TIMESTAMP(),
TRANSACTION_TIMESTAMP();
</code></pre>
<codapi-snippet sandbox="postgres" editor="basic" template="#main.sql"></codapi-snippet>

### Inside a transaction
Running them inside a transaction helps to properly differentiate them
<pre><code class="lang-sql">BEGIN;
SELECT
  NOW() as now_time,
  CURRENT_TIMESTAMP as curr_time,
  TRANSACTION_TIMESTAMP() as txn_time,
  STATEMENT_TIMESTAMP() as stmt_time,
  CLOCK_TIMESTAMP() as clock_time;

SELECT pg_sleep(1); -- sleep for one second

SELECT
  NOW() as now_time,
  CURRENT_TIMESTAMP as curr_time,
  TRANSACTION_TIMESTAMP() as txn_time,
  STATEMENT_TIMESTAMP() as stmt_time,
  CLOCK_TIMESTAMP() as clock_time;
COMMIT;
</code></pre>
<codapi-snippet sandbox="postgres" editor="basic" template="#main.sql"></codapi-snippet>

As you can see from the results above:
- `NOW()`, `CURRENT_TIMESTAMP` and `TRANSACTION_TIMESTAMP()` are indeed the same and reflect the time when the transaction started.
- `STATEMENT_TIMESTAMP()` is different in both because it is the time when current SQL statement began.
- `CLOCK_TIMESTAMP()` is off by a few microseconds from the `CURRENT_TIMESTAMP` and the `STATEMENT_TIMESTAMP()` in both because some time would have passed before it was evaluated, but it is the best approximate to the current wall clock time.

So in reality we have 3 timestamps, one for when a transaction starts (a transaction could be a `DO..END` block, a `FUNCTION` or an explicit `BEGIN..COMMIT` block), one for when a statement starts being executed and one for the actual time at evaluation within a statement (query). 

## Practical Use Cases

### Benchmarking Queries
`STATEMENT_TIMESTAMP()` is particularly useful when you need to measure how long individual SQL statements take within a transaction, we can do this by subtracting it from the `CLOCK_TIMESTAMP()`. For example, we can estimate how long it takes to generate a UUIDv4:

<pre><code class="lang-sql">select gen_random_uuid() uuid,
    clock_timestamp()-statement_timestamp() t,
    round(extract(epoch from clock_timestamp() - statement_timestamp()) * 1000, 3) t_ms;</code></pre>
<codapi-snippet sandbox="postgres" editor="basic" template="#main.sql"></codapi-snippet>

This works because the `STATEMENT_TIMESTAMP()` is generated at the start of the query and the `CLOCK_TIMESTAMP()` is generated after `gen_random_uuid()` returns.
> It should be noted that the queries are being run in your browser for demonstration purposes and doesn't take account for latency in production environments. 

We can see a proper example of some benchmarking below:
<pre><code class="lang-sql">do $$
declare
    t_start double precision;
    t_end   double precision;
begin
    create table test_uuidv4(id uuid primary key default gen_random_uuid(), n bigint not null);
    t_start := extract(epoch from clock_timestamp());
    insert into test_uuidv4(n) select g.n from generate_series(1,10000) as g(n);
    t_end := extract(epoch from clock_timestamp());
    raise notice 'Took %ms to generate and insert 10,000 UUIDv4 records.', (t_end - t_start) * 1000;
end;
$$ language plpgsql;
</code></pre>
<codapi-snippet sandbox="postgres" editor="basic" ></codapi-snippet>

### Generating IDs

When generating IDs using a custom function (for example UUIDv7 [1]) only `CLOCK_TIMESTAMP()` is recommended for use as both `STATEMENT_TIMESTAMP()` and the `TRANSACTION_TIMESTAMP()` variants return the same value as we've seen above. 

<pre><code class="lang-sql">with x as (
    select 
        clock_timestamp() as c,
        statement_timestamp() as s, -- you can replace this with now(), transaction_timestamp() or current_timestamp    
        n
   from generate_series(1, 10) as g(n)
)
select x.n,
       uuid7(x.c) uuid7_clock,
       uuid7(x.s) uuid7_stmt,
       x.c::text ts_clock,
       x.s::text ts_stmt
from x;
</code></pre>
<codapi-snippet sandbox="postgres" editor="basic" template="#uuid7.sql"></codapi-snippet>

## Conclusion
For most use cases [2] `NOW()` or `CURRENT_TIMESTAMP` are sufficient, if you need more accuracy when dealing with time in a complex query you should consider using either `CLOCK_TIMESTAMP()` or `STATEMENT_TIMESTAMP()`.

### When to Use STATEMENT_TIMESTAMP():
- **Statement-Level Timing:** If you need to capture the exact time when a particular SQL statement begins execution, `STATEMENT_TIMESTAMP()` is appropriate.
- **Consistency Within Statements:** For scenarios where consistency within a single statement is needed, and you want a uniform timestamp for all operations within that statement, it ensures that you get the same time.

### When to Use CLOCK_TIMESTAMP():
- **High-Precision Timing:** If your application requires precise or high-resolution timing measurements, such as benchmarking or profiling code execution, `CLOCK_TIMESTAMP()` is suitable.
- **Real-Time Monitoring:** For real-time applications where capturing the exact current time is essential, especially within long-running transactions, functions or procedures, it provides the necessary precision.

## Footnotes
1. [UUIDv7](https://gist.github.com/fabiolimace/515a0440e3e40efeb234e12644a6a346#file-uuidv7-sql-L39) function used.
2. Some common or general timestamp use cases:
   * Audit Trails
   * Time-Based Analytics
   * Data Cleanup/Maintenance
   * Session Management
   * Report Generation
   * Rate Limiting
   * Data Versioning

