---
title: Setting up your own VPN using WireGuard
date: 2024-03-28 12:42:35
---

You need a VM (droplet in Digital Ocean or an EC2 machine in AWS) in a cloud platform.

- First enable packet forwarding
```shell
vim /etc/sysctl.conf
```

- Uncomment this line and save file changes
```shell
# net.ipv4.ip_forward = 1
```

- Apply the changes
```shell
sudo sysctl -p
```

- Run updates
```shell
sudo apt update && sudo apt upgrade
```

- Check if the server requires a reboot
```shell 
cat /var/run/reboot-required
```

- Reboot your VM
```shell
sudo reboot
```

- Install WireGuard
```shell
sudo apt install wireguard
```

- Generate WireGuard keys
```shell
sudo mkdir -p /etc/wireguard/keys; wg genkey | sudo tee /etc/wireguard/keys/server.key | wg pubkey | sudo tee /etc/wireguard/keys/server.key.pub
```

- View server private key
```shell
cat /etc/wireguard/keys/server.key
```

- Determine the default interface
```shell
ip -o -4 route show to default | awk '{print $5}'
```

- Edit WireGuard config
```shell
sudo vim /etc/wireguard/wg0.conf
```

- Add this to your `wg0.conf` file
```ini
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = YOUR_SERVER_PRIVATE_KEY
#PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
#PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
SaveConfig = true
```

When bringing up the tunnel for the first time, you need to set up NATing and you can do that either manually (outside the config) or just uncomment `PostUp` and `PostDown`.

Then you can always comment those configs out and restart the tunnel-which will actually remove those configs from the `/etc/wireguard/wg0.conf` for you-kind of a cleanup by WireGuard

- Set permissions
```shell
sudo chmod 600 /etc/wireguard/wg0.conf /etc/wireguard/keys/server.key
```

- Bring up the WireGuard server
```shell
sudo wg-quick up wg0
```

Add your devices as WireGuard clients
```shell
sudo wg set wg0 peer client-public-key allowed-ips 10.0.0.2/32
```

If you need to troubleshoot connection issues, you can use tcpdump or nmap
```shell
sudo nmap -sU your-vm-ipv4-address -p 51820
```
