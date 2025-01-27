---
title: Dump
date: 2025-01-15 22:12:22
tags:
   - tech
---

<pre><code class="lang-sql">drop function if exists test_uuidv4_insert(count BIGINT);
create or replace function test_uuidv4_insert(count BIGINT) returns DOUBLE PRECISION as $$
declare
    v_start double precision;
    v_end   double precision;
begin
    drop table if exists test_uuidv4;
    create table test_uuidv4(id uuid primary key default gen_random_uuid(), n bigint not null);
    v_start := extract(epoch from clock_timestamp());
    insert into test_uuidv4(n) select g.n from generate_series(1,count) as g(n);
    v_end := extract(epoch from clock_timestamp());
    raise notice 'Time taken to insert %s UUIDv4 records: %s', count, v_end - v_start;
    return v_end - v_start;
end;
$$ language plpgsql;

select test_uuidv4_insert(100000) as t_100_000,
       test_uuidv4_insert(1000000) as t_1_000_000,
       test_uuidv4_insert(10000000) as t_10_000_000;
</code></pre>
<codapi-snippet sandbox="postgres" editor="basic" output-mode="json"></codapi-snippet>

<pre><code class="lang-sql">drop table if exists test_uuidv4;
create table test_uuidv4(id uuid primary key default gen_random_uuid(), n bigint not null);
insert into test_uuidv4(n) select g.n from generate_series(1,100000) as g(n);
select * from test_uuidv4 limit 10;
</code></pre>
<codapi-snippet sandbox="postgres" editor="basic" output-mode="json"></codapi-snippet>

<pre><code class="lang-sql">with x as (select clock_timestamp() as t, n from generate_series(1, 10) as g(n))
select x.n, uuid7(x.t) uuid7, x.t::text ts from x;
</code></pre>
<codapi-snippet sandbox="postgres" editor="basic" template="#uuid7.sql"></codapi-snippet>