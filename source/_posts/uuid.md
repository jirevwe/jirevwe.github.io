---
title: Exploring alternatives to UUIDv4; Enter ULIDs.
date: 2024-11-28 14:05:40
description: UUIDv4 and ULID are both types of unique identifiers that can be used in distributed systems. UUIDv4 stands for Universally Unique Identifier version 4, and ULID stands for Universally Unique Lexicographically Sortable Identifier.
tags: 
  - uuid
  - tech
  - convoy
---

**UUIDv4** is a commonly used unique identifier format. **UUIDv4** is a standardized format for generating unique identifiers that are widely used in distributed systems. Recently there have attempts to introduce new identifier formats that are shorter, url-friendly, lexographically sortable, collision-safe during generation.

To name a few:
- [ksuid](https://github.com/segmentio/ksuid): KSUIDs are 20 bytes (160 bits) IDs with 1-second precision (correctly detects and handles the same second), encoded in alphanumeric [base62](https://en.wikipedia.org/wiki/Base62) as 27 character strings, are URL-friendly and are also lexicographically sortable.  
- [ulid](https://github.com/ulid/spec): ULIDs are 128-bit (16 bytes) IDs with millisecond precision (correctly detects and handles the same millisecond), they are also lexicographically sortable, URL-friendly and are encoded using [Crockford's base32](https://www.crockford.com/base32.html) as 26 character strings.
- [nanoid](https://github.com/ai/nanoid): made at [Evil Martians](https://evilmartians.com/devtools); Nano ID is tiny (124 bytes), secure, URL-friendly, unique ID generator. It is quite comparable to UUID v4 (random-based). It has a similar number of random bits in the ID (126 in Nano ID and 122 in UUID), so it has a similar collision probability.

**ULID**s combines a timestamp and a random component to generate a unique value that is also lexicographically sortable.

## UUIDv4 

From the [UUIDv4 spec](https://datatracker.ietf.org/doc/html/rfc4122#section-4.4), it is constructed by generating random number.

```text UUIDv4 spec
Sample ID: 4fcc81d9-9512-4b2e-9267-b5e057d5007a

   4fcc81d9-9512-      4           b2e-            9          267-b5e057d5007a
  |--------------|    |-|         |----|          |-|        |----------------|
     Randomness     Version*    Randomness      Version**        Randomness

*  Set the four most significant bits of the 7th byte '0100',
       so that the Hex value always starts with a 4,
       
** Set the 2 most significant bits of the 9 th byte to '10', 
        so that the Hex value will always start with a 8, 9, A , or B.  
```

1. **Standardization**: UUIDv4 is a standardized format defined by [RFC 4122](https://www.ietf.org/rfc/rfc4122.txt), which means it is widely recognized and understood by developers across different languages and platforms. This makes it easier to integrate with other systems and tools that use UUIDv4.
2. **Large namespace**: UUIDv4 has a larger namespace than ULID, which means that it can generate a larger number of unique identifiers. This is useful in systems with a high rate of data generation or where a large number of unique identifiers are required.
3. **Randomness**: UUIDv4 is generated using a random or pseudo-random algorithm, which makes it difficult to predict or guess the next value in the sequence. This can be useful in security-sensitive applications or where unpredictability is important.

## ULID

From the official [ULID spec](https://github.com/ulid/spec), it is constructed by concatenating a timestamp with a random suffix:
```text ULID spec
Sample ID: 01ARZ3NDEKTSV4RRFFQ69G5FAV

   01ARZ3NDEK        TSV4RRFFQ69G5FAV
 |------------|    |------------------|
   Timestamp            Randomness
    48bits                80bits
```
This provides several nice properties:
1. **They are lexicographically sortable**: We made the change solely because we wanted to incorporate cursor based pagination, which is really important for reading a large dataset. When your dataset it large enough, offset pagination (using limit and skip in queries) starts to become slow, meaning if you have over 100k events your dashboard will slow to a crawl when loading and searching events/deliveries.
2. **They are better used as indexes**: ULIDs work very well with Postgres B-Tree indexes.
3. **They are URL friendly**: ULIDs are more compact, they use Crockford’s base32 for better efficiency and readability (5 bits per character) which make it easy to copy-and-paste (`01ARZ3NDEKTSV4RRFFQ69G5FAV`), unlike hyphenated UUIDs which are in base 16 (e.g. `4fcc81d9-9512-4b2e-9267-b5e057d5007a`).
4. **They are unique with millisecond precision**: ULIDs generated in the same second will be unique based on the random component even in a distributed system. The random component has enough entropy to avoid collisions in practical uses.
5. **We use them for Idempotency Keys**: To ensure the reliable delivery of an event on a large scale, it is essential for the idempotency key to be unique during the desired time frame for the event to be retryable, typically less than one minute.


## Differences and Tradeoffs between UUIDs and ULIDs:
| Format | Sortable | 	Monotonic | Randomness |
|--------|----------|------------|------------|
| UUIDv4 | No       | No         | 122 bits   |
| ULID   | Yes      | Yes        | 80 bits *  |

     * Random bits are incremented sequentially within the same millisecond.

### Generating
When creating both **UUIDs** and **ULIDs**, the process of generating **ULIDs** is a little slower when producing 100 million values, and the difference is negligible when generating and inserting 1 million values. Generating **ULIDs** are slower than **UUIDs**, though, the benefits of a sortable globally unique identifier make the tradeoff worth it.

| **Identifier**               | **1M Rows (ms)** | **10M Rows (ms)** | **100M Rows (s)** |
|------------------------------|------------------|-------------------|-------------------|
| **ULID** (`generate_ulid`)   | 262              | 845               | 5.9               |
| **UUID** (`gen_random_uuid`) | 205              | 732               | 5.5               |

<pre><code class="lang-sql">select generate_ulid(now()) FROM generate_series(1, 10000000);
-- 100m - 5.9s, 10m - 845ms, 1m - 262ms

select gen_random_uuid() FROM generate_series(1, 10000000);
-- 100m - 5.5s, 10m - 732ms, 1m - 205ms
</code></pre>

### Inserting
When inserting **ULID**s, it takes about **3.27x longer** than **UUID**s inserts. This reflects the additional computational overhead for inserting **ULID**s.

| **Operation**                       | **1M Rows (s)** | **10M Rows (s)** | **100M Rows (s)** | 
|-------------------------------------|-----------------|------------------|-------------------|
| **UUID Insert** (`gen_random_uuid`) | 1.76            | 18.10            | 187.51            |
| **ULID Insert** (`generate_ulid`)   | 5.75            | 58.04            | 586.48            |

<pre><code class="lang-sql">drop table uuid_test;
drop table ulid_test;
CREATE TABLE uuid_test(id UUID);
CREATE TABLE ulid_test(id TEXT);

EXPLAIN ANALYSE INSERT INTO uuid_test(id)
SELECT gen_random_uuid() FROM generate_series(1, 1000000);
-- 100m - 187510.769ms, 10m - 18100.076ms, 1m - 1755.845ms

EXPLAIN ANALYSE INSERT INTO ulid_test(id)
SELECT generate_ulid(now()) FROM generate_series(1, 1000000);
-- 100m - 586484.947ms, 10m - 58038.249ms, 1m - 5745.083ms
</code></pre>

### Timing
Timing information can be unintentionally exposed through **ULIDs**, revealing the speed at which a particular resource is generated. By analyzing ULIDs, it becomes possible to deduce the rate at which a service is generating events, thereby disclosing potentially valuable competitive data that should remain confidential.

## How did this affect production data?
With our release of [`v0.9.x`](https://github.com/frain-dev/convoy/releases/tag/v0.9.2) and [`v23.05.x`](https://docs.getconvoy.io/changelog/core-gateway#v23-5), we (at [Convoy](https://getconvoy.io/)) migrated our main datastore from MongoDB to Postgres, and we decided to change our ID format.

1. Old resources still used the old UUIDv4 format.
2. Pagination for all old resources broke. We were sorting on the ID which made them out of order since UUIDv4 isn't lexicographically sortable.
3. All new resources use the new ULID format.
4. Pagination for new resources like event and event-deliveries were returned alongside the older records bubbled up when the retention policy kicked in, those older records were deleted, and users started seeing only resources with new IDs.

## What did this mean for our user's data?
At Convoy, we strive to make sure that our software is backwards compatible and that little effort is required on our user's part, so your workloads can operate while we move things around internally. We ensure that the contract we keep with our API is never broken. In this case, we unfortunately had to make the change, so we as a company and Convoy as a product could evolve into a version of the vision that we have.

## Conclusion
Although a little slower to generate, **ULIDs** provide many pros over the pure random **UUIDv4** that lots of large companies running work-loads at scale have adopted. As a company building for the scale of our current users and future scale of the general internet, we are always looking to adopt and implement technologies that will work at companies of all sizes, sending and ingesting any number of webhook events.

With the release of [UUIDv7](https://www.ietf.org/archive/id/draft-peabody-dispatch-new-uuid-format-01.html#name-uuidv7-layout-and-bit-order) that offers some benefits as ULIDs and are native to Postgres as of December 2024 (see the [commit here](https://github.com/postgres/postgres/commit/78c5e141e9c139fc2ff36a220334e4aa25e1b0eb#diff-229a1fe1ecaae95e35dcb9270c20c6d0bf37f33fbf019dfbd7f9ef014b07c0e3)), it might be better to switch to UUIDv7 in the future if one doesn't care about URL friendliness.  

## Updates
* Relevant HN Discussion: https://news.ycombinator.com/item?id=42533557

## References
- [ULID Primary Keys](https://blog.daveallie.com/ulid-primary-keys)
- [Using ULIDs at incident.io](https://blog.lawrencejones.dev/ulid)
- [UUID V4 Random Generation](https://www.intl-spectrum.com/Article/r848/IS_UUID_V4_UUID_V4_Random_Generation)
- [Choosing Primary Key Type in Postgres](https://shekhargulati.com/2022/06/23/choosing-a-primary-key-type-in-postgres/)
- [RFC 9562 Universally Unique IDentifiers (UUIDs)](https://datatracker.ietf.org/doc/rfc9562/)
