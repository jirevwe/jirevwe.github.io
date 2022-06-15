---
title: MongoDB Single Node Replica Set
date: 2022-06-09 20:35:09
tags:
---

## The Problem

If you're like me and you're building non-trivial software and you use MongoDB as a datastore you'd know that it can be a pain in the ass to work around the fact that MongoDB doesn't support transactions when running it on localhost, so you might just use a free replica set on MongoDB, but that's not ideal esp if you live somewhere with a not so great internet connection.

## Setup

You can run MongoDB as a single-node replica-set on your local machine. Depending on how you installed MongoDB this setup might be different. I'm currently on `Ubuntu 20.04.4 LTS`, and I'm using the `apt` package manager. Installing mongodb using apt will create a daemon that runs mongodb in the background.

## The Solution

According to [mongodb's documentation](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/), a `mongod` standalone instance can be converted to a replica set by passing a cli flag with the replica set name.

1. Stop the currently running MongoDB Daemon

```
systemctl stop mongod.service
```

2. Edit the service unit file

```sh
vi /lib/systemd/system/mongod.service
```

3. Update the lin

```sh
...
ExecStart=/usr/bin/mongod --config /etc/mongod.conf --replSet replica-set-name
...
```

## Hot-fix

```sh
chown -R mongodb:mongodb /var/lib/mongodb
chown mongodb:mongodb /tmp/mongodb-27017.sock
```
