---
title: TIL - DNS Roundrobin
date: 2023-05-12 10:02:06
tags:
    - til
    - dns
    - load balancing
---

DNS round-robin is a simple and widely-used technique for load balancing and distributing incoming network traffic across multiple servers or IP addresses.

In DNS round-robin, a single hostname is associated with multiple IP addresses. When a client makes a request to the hostname, the DNS server responds with a different IP address for each request, cycling through the list of IP addresses in a round-robin fashion. This means that each client request is directed to a different server, distributing the load across multiple servers.

For example, if you have three servers with IP addresses 192.168.1.1, 192.168.1.2, and 192.168.1.3, you could set up a DNS round-robin configuration where the hostname "example.com" resolves to all three IP addresses. When a client requests "example.com", the DNS server will respond with one of the IP addresses in the list, such as 192.168.1.1. The next time a client requests "example.com", the DNS server will respond with the next IP address in the list, such as 192.168.1.2. This continues in a round-robin fashion, distributing the traffic across all three servers.

DNS round-robin is a simple and effective way to distribute traffic across multiple servers, but it has some limitations. For example, if one of the servers becomes unavailable, the DNS server will still include its IP address in the round-robin list, potentially directing traffic to an unavailable server. Additionally, DNS caching can affect the distribution of traffic and cause some clients to be directed to the same server repeatedly. Despite these limitations, DNS round-robin is still widely used for load balancing and can be a useful tool in many scenarios.

Here are some differences between DNS round-robin and normal load balancing:

| Feature| DNS Round-Robin| Normal Load Balancing|
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Load distribution        | Distributes traffic across multiple servers by returning different IP addresses for each request in a round-robin fashion | Distributes traffic across multiple servers by intelligently routing traffic based on factors such as server capacity, performance, and health |
| Configuration            | Simple to configure by adding multiple IP addresses for a single hostname in DNS records                                  | Requires more complex configuration using specialized load balancing software or hardware                                                      |
| Server health monitoring | Does not actively monitor server health and can direct traffic to an unresponsive server                                  | Actively monitors server health and can route traffic away from unresponsive servers                                                           |
| Failure handling         | Does not handle server failure and can continue to direct traffic to an unresponsive server                               | Can detect server failures and route traffic away from unresponsive servers to ensure high availability                                        |
| Scalability              | Limited scalability due to DNS caching and potential uneven distribution of traffic                                       | Can scale to handle large amounts of traffic and provide consistent performance                                                                |
| Granularity              | Lacks granular control over traffic distribution and cannot target specific traffic flows or server resources             | Provides granular control over traffic distribution and can target specific traffic flows or server resources                                  |

Overall, DNS round-robin is a simple and low-cost method for distributing traffic across multiple servers, but it lacks the advanced features and scalability of normal load balancing solutions. Normal load balancing provides more granular control over traffic distribution, better server health monitoring, and can scale to handle large amounts of traffic.
