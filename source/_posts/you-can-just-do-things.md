---
title: You Can Just Do Things
date: 2024-12-31 18:31:18
tags:
  - motivation
  - tech
  - convoy
---

I’ve been working on a proper solution to Convoy’s data retention using Postgres partitioning ([PR here](https://github.com/frain-dev/convoy/pull/2194)). This is needed because we operate a multi-tenant SaaS, and some users generate a large amount of traffic daily. Our current (and obviously) naive approach is deleting rows based on the customer’s retention policy. However, deletes are expensive and trigger [autovacuum](https://www.postgresql.org/docs/current/routine-vacuuming.html), which causes massive performance degradation; we can bypass it by dropping partitions of a tenant (customer) for a particular day directly.

Partitioning (like all things in tech) isn’t free and has its [own issues](https://www.youtube.com/watch?v=YPorP8BsF_c), but we’re willing to experiment with it, continually improve it, or scrap it if it doesn’t work well. The defacto tool ([pg_partman](https://github.com/pgpartman/pg_partman)) doesn’t support [multi-column partitioning](https://www.dragonflydb.io/faq/postgres-partition-by-multiple-columns), so I built a tool in Go named [go_partman](https://github.com/jirevwe/go_partman) to automate partition maintenance (creation and deletion). Building it was so much fun. I learned about database partitioning, discovered some database OGs while reading multiple Stackoverflow posts, learned how to write more complex SQL queries, and had a lot of anxiety designing the library’s public API; I think I did well, haha. I'm looking forward to improving it, so feedback and suggestions are welcome!

Here’s to building competency in 2025. Remember, you can just do things.

Happy New Year.