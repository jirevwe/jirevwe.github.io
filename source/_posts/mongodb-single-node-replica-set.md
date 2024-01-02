---
title: MongoDB Single Node Replica Set
date: 2022-06-09 20:35:09
tags: 
    - tech 
    - databases
    - mongodb
---

## The Problem

If you're like me and you're building non-trivial software and you use MongoDB as a datastore you'd know that it can be a pain in the ass to work around the fact that MongoDB doesn't support transactions when running it locally, so you might opt to use a shared instance on MongoDB Altas or look for a docker compose file that spins up a replica set, but that's not ideal because it's an extra thing you have to setup.

## Setup

You can run MongoDB as a single-node replica-set on your local machine. Depending on how you installed MongoDB this setup might be different. I'm currently on `Ubuntu 20.04.4 LTS`, and I'm using the `apt` package manager. Installing mongodb using apt will create a daemon that runs mongodb in the background.

## The Solution

According to [MongoDB's documentation](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/), a `mongod` standalone instance can be converted to a replica set by passing a cli flag with the replica set name.

1. Stop the currently running MongoDB Daemon

```
systemctl stop mongod.service
```

2. Edit the service unit file

```sh
vi /lib/systemd/system/mongod.service
```

3. Update the `ExecStart` command

```sh
...
ExecStart=/usr/bin/mongod --config /etc/mongod.conf --replSet [my-replica-set-name]
...
```

4. Reload `systemd`

```sh
sudo systemctl reload mongod
```

5. The permission settings on `/var/lib/mongodb` and `/tmp/mongodb-27017.lock` are wrong, so you will have to change the owner to monogdb. You can read more about it [here](https://askubuntu.com/questions/823288/mongodb-loads-but-breaks-returning-status-14) and [here](https://stackoverflow.com/questions/60309575/mongodb-service-failed-with-result-exit-code).

```sh
chown -R mongodb:mongodb /var/lib/mongodb
chown mongodb:mongodb /tmp/mongodb-27017.sock
```

6. Restart the MongoDB Daemon

```sh
sudo systemctl start mongod.service
```

7. Connect to the MongoDB instance with this connection URI

```sh
mongodb://localhost:27017/test?retryWrites=true&w=majority&replicaSet=[my-replica-set-name]

```

This would get you up and running in a few minutes but once the package is updated you'd have to redo the process again.

## A Shorter Solution

I built a cli tool that makes the process trivial, it's called `rs` and you can snag the binary from [here](https://github.com/jirevwe/rs/releases/tag/v0.1.2).

It's really easy to setup a single node replica set, you can run there commands to get started

1. This downloads and unpacks MongoDB (the default is v4.2.21) into a folder in your home directory

```sh
rs download
```

2. Run the replica set

```sh
rs run
```

3. Connect to the MongoDB instance with this connection URI

```sh
mongodb://localhost:27017/test?retryWrites=true&w=majority&replicaSet=localhost

```

## Notes

1. There's a known issue with the `rs` cli tool where `mongod` would fail to start, the fix is delete the `data` folder for that distribution. Haha, I know it's not elegant but the tool has served it's purpose.
2. if you want you can use `rs` to download and run different mongodb distributions if that's something you want to do.
