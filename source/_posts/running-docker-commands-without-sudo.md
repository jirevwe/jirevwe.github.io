---
title: Running Docker commands without sudo
date: 2022-08-16 15:13:01
tags:
---

# Run Docker commands without sudo

1. Add the `docker` group if it doesn't already exist

```console
$ sudo groupadd docker
```

2. Add the connected user `$USER` to the docker group

`$USER` will be set to the currently logged in user

```console
$ sudo gpasswd -a $USER docker
```

**IMPORTANT**: Log out and log back in so that your group membership is re-evaluated. I had to restart my PC for some reason to get it to work.

3. Restart the `docker` daemon

```console
$ sudo service docker restart
```

## Notes

You can read more about it [here](https://askubuntu.com/questions/477551/how-can-i-use-docker-without-sudo) and [here] (https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user)
