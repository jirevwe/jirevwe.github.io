---
title: SQL NULLs are Weird!
date: 2025-01-05 12:54:41
tags:
  - til
  - tech
  - interactive
---
Yes, you read that right. SQL does treat all NULLs as distinct values. I learnt this a while back while working on [Convoy](https://getconvoy.io/) and again on [LiteQueue](https:/github.com/jirevwe/litequeue): a Golang a queueing library. 

Basically, any column with a UNIQUE constraint can have multiple NULL values, because each NULL value is a distinct value that is different from other NULLs, and this is even less obvious if you're used to using ORMs. I tested this with SQLite, Postgres and MYSQL and they all behave like this. Let's prove this with some examples

## Establishing a baseline
First, let’s establish a baseline to further highlight how this can be confusing. We’ll be comparing different values using the logical equals ("=") operator and, even with basic programming experience, the results might not be what you expect:

<pre><code class="lang-sql">select '' = '';    -- Returns 1 (true) because empty strings are equal
select 1 = 1;      -- Returns 1 (true) because the numbers are equal
select 1 = 0;      -- Returns 0 (false) because the numbers are different
select null = null; -- Returns NULL (null) because... wait what?</code></pre>
<codapi-snippet engine="wasi" sandbox="sqlite" editor="basic"></codapi-snippet>

`select null = null;` returns NULL, because each NULL is basically a placeholder representing any ["unknown value"](https://www.youtube.com/watch?v=cBw0c-cmOfc&t=13s). Two unknown values are not necessarily the same value; we can't say that they are equal, because we don't know the value of either of them. So it evaluates to an "unknown value" that's obviously not "true" or "false", which is why `NULL = NULL` returns `NULL`. Very weird, ikr! So now we've established that two NULL values in the same column are not considered equal using "="; but we can use `IS`, because the `IS` operator checks for identity or rather if the type of both values are, well, NULL.

<pre><code class="lang-sql">select null is null; -- Returns 1 (true) because IS checks for NULL identity</code></pre>
<codapi-snippet engine="wasi" sandbox="sqlite" editor="basic"></codapi-snippet>

I'll demonstrate this using one more example, which shows that NULL values are not equal to each other, but string values are (also applies to other values as well). The result will have all `equal_comparison` columns where two NULLs are compared to be NULL and all `is_comparison` columns where two NULLs are compared as 1; the string-to-string and string-to-null comparison results are pretty obvious. 

<pre><code class="lang-sql">drop table if exists sample;
CREATE TABLE if not exists sample (
     id INTEGER PRIMARY KEY, -- auto-increment
     name TEXT -- UNIQUE -- uncomment this line
);

INSERT INTO sample (name) VALUES (NULL), (NULL), ('test'); --, ('test');

SELECT
    a.id as id1,
    b.id as id2,
    coalesce(a.name, 'null') || ', ' || coalesce(b.name, 'null') as names,
    a.name = b.name as equal_comparison,
    a.name IS b.name as is_comparison
FROM sample a
    CROSS JOIN sample b -- creates an n by m loop on all the table's records.
WHERE a.id < b.id;</code></pre>
<codapi-snippet engine="wasi" sandbox="sqlite" editor="basic"></codapi-snippet>

## What about Uniqueness?

Well, they'll break based on "normal" reasoning so if you just pair two columns and expect it to work, I have bad news for you :D. First we create our schema we'll use to test throughout this post and confirm that our table actually has the `UNIQUE` constraint.

<pre><code class="lang-sql">drop table if exists sample;
create table if not exists sample (
    id TEXT primary key,
    email TEXT,
    deleted_at TEXT,
    UNIQUE(email, deleted_at)
) strict;

-- check to see if our constraint was actually defined as part of the table
SELECT sql FROM sqlite_schema WHERE name = 'sample';
</code></pre>
<codapi-snippet engine="wasi" sandbox="sqlite" editor="basic"></codapi-snippet>

Then we'll insert two records which normally should not be allowed to be inserted.
<pre><code class="lang-sql">drop table if exists sample;
create table if not exists sample (
    id TEXT primary key,
    email TEXT,
    deleted_at TEXT,
    UNIQUE(email, deleted_at)
) strict;

insert into sample (id, email, deleted_at) values ('1', 'ray@mail.com', null);

-- This will not fail because the constraint doesn't hold
insert into sample (id, email, deleted_at) values ('2', 'ray@mail.com', null);

-- check the content of the sample table
select * from sample;</code></pre>
<codapi-snippet engine="wasi" sandbox="sqlite" editor="basic"></codapi-snippet>

If you ran the snippets you can see that both rows were actually inserted into the table and that the constraint was actually defined in the table. So now we have three questions:
1. Why does this happen?
2. Why are NULLs handled this way?
3. How then can we ensure uniqueness?

## Why does this happen?
Well, the two rows are actually unique! The first row `('ray@mail.com', NULL)` and the second row `('ray@mail.com', NULL)` are not the same because the NULL values, as we established earlier, are different.

## Why are NULLs handled this way?
According to the [SQLite docs](https://www.sqlite.org/nulls.html), SQLite, and other SQL compliant databases were implemented like this to handle NULLs in line with how other databases implement NULLs. Apparently none of them follow the SQL standards specification ——if only we could read (or refer) it, I'll comment on this at the end. Here's a quote from the [SQLite docs](https://www.sqlite.org/nulls.html):
> The fact that NULLs are distinct for UNIQUE columns but are indistinct for SELECT DISTINCT and UNION continues to be puzzling. It seems that NULLs should be either distinct everywhere or nowhere. And the SQL standards documents suggest that NULLs should be distinct everywhere. Yet as of this writing, no SQL engine tested treats NULLs as distinct in a SELECT DISTINCT statement or in a UNION.

The `UNIQUE(email, deleted_at)` constraint ensures no two rows have the same combination of email and deleted_at, but it allows multiple rows with the same email as long as `deleted_at` differs.

## How then can we ensure uniqueness?
We'll explore two ways to mitigate this.

### Using a generated column

To mitigate against the issue of NULLs not being a deterministic value we can create another field that always has a deterministic value. It will be a generated column that's set ON INSERT and ON UPDATE. We can define that field thus:
<pre><code class="lang-sql">CREATE TABLE sample (
    id TEXT PRIMARY KEY,
    email TEXT,
    deleted_at TEXT, -- nullable
    _deleted_at_coalesced TEXT GENERATED ALWAYS 
        AS (COALESCE(deleted_at, '1970-01-01')) STORED, -- not nullable
    UNIQUE(email, _deleted_at_coalesced)
) STRICT;</code></pre>

The new field `_deleted_at_coalesced` will be set to `'1970-01-01'` whenever `deleted_at` is `NULL`. This leads to an extra field making your table wider and larger (because the extra field takes space) which might be negligible for a small table but with millions of rows, that extra field's existence uses up more space. 

Let's test a full example using the generated field, you can play around with it adding `select * from sample;` after each line to see the steps.

<pre><code class="lang-sql">drop table if exists sample;
CREATE TABLE sample (
    id TEXT PRIMARY KEY,
    email TEXT,
    deleted_at TEXT, 
    _deleted_at_coalesced TEXT GENERATED ALWAYS AS (COALESCE(deleted_at, '1970-01-01')) STORED, 
    UNIQUE(email, _deleted_at_coalesced)
) STRICT;

insert into sample (id, email, deleted_at) values ('1', 'ray@mail.com', null);

-- This will fail due to because of the constraint on the email and the generated column. Uncomment it to test it out
-- insert into sample (id, email, deleted_at) values ('2', 'ray@mail.com', null);

insert into sample (id, email, deleted_at) values ('3', 'ray@mail.com', '2024-11-12T00:00:00.000Z');

insert into sample (id, email, deleted_at) values ('4', 'ray@mail.com', '2024-11-11T01:00:00.000Z');

insert into sample (id, email, deleted_at) values ('6', 'different@mail.com', null);

update sample set deleted_at = '2024-11-11T02:00:00.000Z' where deleted_at is null;

insert into sample (id, email, deleted_at) values ('7', 'different@mail.com', null);

update sample set deleted_at = '2024-11-11T03:00:00.000Z' where deleted_at is null;

insert into sample (id, email, deleted_at) values ('8', 'different@mail.com', null);

select * from sample;</code></pre>
<codapi-snippet engine="wasi" sandbox="sqlite" editor="basic"></codapi-snippet>

While this works, there's a flaw. Deleting the same record twice (basically when the tuple exists already) won't work. Let's test this.

<pre><code class="lang-sql">drop table if exists sample;
CREATE TABLE sample (
    id TEXT PRIMARY KEY,
    email TEXT,
    deleted_at TEXT, 
    _deleted_at_coalesced TEXT GENERATED ALWAYS AS (COALESCE(deleted_at, '1970-01-01')) STORED, 
    UNIQUE(email, _deleted_at_coalesced)
) STRICT;

insert into sample (id, email, deleted_at) values ('1', 'ray@mail.com', null);

update sample set deleted_at = '2024-11-11T03:00:00.000Z' where id is 1;

insert into sample (id, email, deleted_at) values ('2', 'ray@mail.com', null);

select * from sample;

-- This will fail due to because of the email and generated column tuple already exists. Uncomment it to test it out
-- update sample set deleted_at = '2024-11-11T03:00:00.000Z' where id is 2;</code></pre>
<codapi-snippet engine="wasi" sandbox="sqlite" editor="basic"></codapi-snippet>

### Using a partial index

Now let's explore a proper solution to the problem. Indexes also take up space, the size of which you can estimate in the database of your choice. Indexes also impact insert times, they are majorly influenced by how many indexes exist on the table and the combination of keys in those indexes. So use them wisely! 

We're going to be using a partial index on `email` where the `deleted_at` field is `NULL`.

<pre><code class="lang-sql">CREATE UNIQUE INDEX if not exists idx_sample_email_deleted_at
    ON sample(email) WHERE deleted_at IS NULL;</code></pre>

Let's test it now, we'll insert some records, update them and insert similar conflicting records.

<pre><code class="lang-sql">drop table if exists sample;
create table if not exists sample (
    id TEXT primary key,
    email TEXT,
    deleted_at TEXT
) strict;

CREATE UNIQUE INDEX if not exists idx_sample_email_deleted_at
    ON sample(email) WHERE deleted_at IS NULL;

insert into sample (id, email, deleted_at) values ('1', 'ray@mail.com', null);

-- This will fail due to idx_sample_email_deleted_at, uncomment it to test it out
-- insert into sample (id, email, deleted_at) values ('2', 'ray@mail.com', null);

insert into sample (id, email, deleted_at) values ('3', 'ray@mail.com', '2024-11-12T00:00:00.000Z');

insert into sample (id, email, deleted_at) values ('4', 'ray@mail.com', '2024-11-11T01:00:00.000Z');

insert into sample (id, email, deleted_at) values ('6', 'different@mail.com', null);

update sample set deleted_at = '2024-11-11T02:00:00.000Z' where deleted_at is null;

insert into sample (id, email, deleted_at) values ('7', 'different@mail.com', null);

update sample set deleted_at = '2024-11-11T03:00:00.000Z' where deleted_at is null;

insert into sample (id, email, deleted_at) values ('8', 'different@mail.com', null);

select * from sample;</code></pre>
<codapi-snippet engine="wasi" sandbox="sqlite" editor="basic"></codapi-snippet>

Using a partial index is the best way to ensure the unique constraint is held without making your table wider, managing an extra field, it consumes less space and isn’t (AS) error-prone when deleting the same record pair over and over again! 

## Update
* [Oracle treats empty strings as NULL for some reason](https://stackoverflow.com/a/13278879), welp!
* Modern database engines allow you to specify if you want to NULLs to be distinct. [//]: todo: edit article to show this behaviour
    * https://news.ycombinator.com/item?id=42651648
* Relevant HN discussion: https://news.ycombinator.com/item?id=42645110
* Relevant discussion on Reddit r/programming: https://www.reddit.com/r/programming/comments/1hxi1tg/sql_nulls_are_weird/

## Conclusion
While this might seem trivial to experienced engineers and invisible when you use an ORM; it's often overlooked and can lead to confusion if you don't know how it works. Another fun thing I discovered is that the SQL standard document (think HTTP RFC but for SQL) isn't publicly available, but can be procured for a fee.
* https://news.ycombinator.com/item?id=35567708
* https://stackoverflow.com/questions/21813895/where-can-i-find-sql-language-specification
