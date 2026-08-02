# Comprehensive Guide: Setting up a Scalable Server for Video Conferencing App (Including Self-Hosted Jitsi)

This document outlines how to set up and deploy your entire video conferencing stack—including your **Node.js/React Application** AND your **Self-Hosted Jitsi Infrastructure**—on Oracle Cloud, AWS, and Google Cloud. It is designed to scale and dynamically handle 200-300 concurrent users. 

## Cost Breakdown: Why Oracle is Virtually Free (₹0 to ₹4000/month)

**Important Cost Note:** Video streaming consumes massive amounts of outbound bandwidth (egress). **Oracle Cloud** is highly recommended because it offers **10 TB of free outbound data per month**. AWS and Google Cloud charge heavily for outbound bandwidth, making them very expensive (often $500-$1000+) for self-hosting video.

### 1. The "Always Free" Tier (Cost: $0 / ₹0)
Oracle Cloud's "Always Free" tier is incredibly generous and can theoretically run your entire setup for free if utilized efficiently:
* **Compute (Servers):** Oracle provides 4 ARM OCPUs and 24 GB RAM for life. You can split this to host your Jitsi infrastructure:
  * **Master Node:** 1 OCPU, 6 GB RAM
  * **JVB Node 1:** 1.5 OCPU, 9 GB RAM
  * **JVB Node 2:** 1.5 OCPU, 9 GB RAM
* **Node.js App Servers:** Oracle provides 2 AMD micro servers (1GB RAM each) for free, which can run your Node.js backend.
* **Load Balancer:** 1 Flexible Load Balancer is always free.
* **Data Transfer (Bandwidth):** 10 TB (10,000 GB) per month is free.
  * *Calculation:* 300 concurrent users on a video call consume roughly 150-200 GB per hour. This gives you about **50 hours** of full-capacity 300-user video calling per month for absolutely free.

### 2. Exceeding the Free Tier (Pay-As-You-Go)
If your app goes viral and you need more power or data, Oracle is still significantly cheaper than competitors:
* **Extra Data Egress:** Once the 10 TB is exhausted, Oracle charges only **$0.0085 per GB** (AWS charges ~$0.09 per GB, which is 10x more expensive).
* **Extra ARM Servers:** Adding another 2 OCPU / 12GB RAM instance will only cost around **$15-$20 (₹1200 - ₹1600) per month**.
* **Estimated Bill for Heavy Usage:** Even with daily heavy meetings requiring extra servers and bandwidth, your monthly bill on Oracle would range from **$25 to $50 (₹2000 - ₹4000)**. The same traffic on AWS/GCP would cost upwards of $1000 just for the bandwidth.

---

## PART 1: Self-Hosting Jitsi for 200-300 Users (The Video Infrastructure)

To handle 200-300 concurrent video users, a single server is not enough. You must use a **Split Architecture** where the Web Frontend/Signaling is on one server (Master), and the video routing is handled by multiple Videobridges (JVBs).

* 1x **Master Node:** Hosts Nginx, Prosody (XMPP signaling), Jicofo (Focus component), and Jitsi Meet frontend.
* 2x to 3x **JVB Nodes (Jitsi Videobridge):** Dedicated servers just for routing video packets. (1 JVB can comfortably handle ~100-120 active video streams depending on server shape).

### Detailed Setup on Oracle Cloud Infrastructure (OCI)

#### Step 1: Provisioning the Instances
1. **Master Node:** 
   - **Shape:** `VM.Standard.A1.Flex` (ARM) or `VM.Standard.E4.Flex` (AMD). 
   - **Specs:** 2 OCPUs, 8GB RAM.
   - **OS:** Ubuntu 22.04.
2. **JVB Nodes (Create 2 or 3 of these):**
   - **Shape:** `VM.Standard.A1.Flex` (ARM - Always free tier allows up to 4 OCPUs and 24GB RAM total, you can use paid shapes if you need more).
   - **Specs:** 4 OCPUs, 16GB+ RAM each.
   - **OS:** Ubuntu 22.04.

#### Step 2: Networking & Firewall (Crucial!)
In your Oracle VCN Security List, you **MUST** open the following ports:
- **Master Node:** `TCP 80` (HTTP), `TCP 443` (HTTPS), `TCP 22` (SSH), `TCP 5222` (XMPP client - internal), `TCP 5269` (XMPP server), `TCP 5347` (Internal JVB communication).
- **JVB Nodes:** `UDP 10000` (CRITICAL for Video/WebRTC routing), `TCP 4443` (Fallback WebRTC), `TCP 22` (SSH).

#### Step 3: Installing the Master Node (Signaling & Web)
SSH into your **Master Node**:

1. Setup hostname (e.g., `meet.yourdomain.com`) and ensure DNS A record points to this server's Public IP.
```bash
sudo hostnamectl set-hostname meet.yourdomain.com
```
2. Add Jitsi repository and install:
```bash
curl https://download.jitsi.org/jitsi-key.gpg.key | sudo sh -c 'gpg --dearmor > /usr/share/keyrings/jitsi-keyring.gpg'
echo 'deb [signed-by=/usr/share/keyrings/jitsi-keyring.gpg] https://download.jitsi.org stable/' | sudo tee /etc/apt/sources.list.d/jitsi-stable.list
sudo apt update
# Install the core components (Do not install jitsi-videobridge2 here yet)
sudo apt install jitsi-meet -y
```
*(During installation, enter `meet.yourdomain.com` and select 'Generate a new self-signed certificate').*

3. Run the Let's Encrypt script for SSL:
```bash
sudo /usr/share/jitsi-meet/scripts/install-letsencrypt-cert.sh
```

#### Step 4: Configuring the External Videobridges (JVBs)
By default, the Master Node installs a local JVB. Disable it so we can use our dedicated JVB servers:
```bash
# On Master Node
sudo systemctl stop jitsi-videobridge2
sudo systemctl disable jitsi-videobridge2
```

Now, SSH into each of your **JVB Nodes**:
1. Add the Jitsi repo just like in Step 3.
2. Install ONLY the videobridge:
```bash
sudo apt install jitsi-videobridge2 -y
```
3. Configure the JVB to connect to the Master Node. Edit `/etc/jitsi/videobridge/sip-communicator.properties` and `/etc/jitsi/videobridge/jvb.conf` to point the XMPP connection to your Master Node's Private IP.
4. Restart JVB: `sudo systemctl restart jitsi-videobridge2`

*Jicofo (on the Master Node) will automatically detect the new JVB servers and start distributing user meetings across them!*

---

## PART 2: App Server Architecture (Node.js & React)

Now that Jitsi is hosted, you need to host your custom Node.js Backend and React frontend that interacts with it.

**Key Architectural Components:**
1. **Load Balancer:** Distributes incoming API/WebSocket traffic.
2. **Stateless Backend:** Node.js backend must be stateless (sessions in Redis).
3. **Redis (Pub/Sub):** Essential for Socket.io to sync events across multiple Node.js backend servers (Redis Adapter).

### Oracle Cloud Detailed Setup

#### Step 1: Provisioning Compute Instances for the App
1. Create 2 more instances (`VM.Standard.A1.Flex`, 1 OCPU, 6GB RAM).
2. Install Node.js & PM2 on both:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2
```
3. Clone your repo, `npm install`, and start with `pm2 start server.js`.

#### Step 2: Oracle Flexible Load Balancer
1. Go to **Networking > Load Balancers** and create a Flexible Load Balancer.
2. **Backend Set:** Create a backend set on Port `5000` (or your Node port). 
   - **CRITICAL:** ENABLE **Session Persistence (Sticky Sessions)**. This is required for WebSockets/Socket.io to work properly across multiple servers.
3. Add your 2 Node.js instances to the backend set.
4. Add an HTTPS listener to the Load Balancer with your SSL certificate.

#### Step 3: Redis & Database
- **Redis:** Spin up a small instance for Redis or use a service like Upstash. Update your Node.js code to use `@socket.io/redis-adapter` so sockets on `Node-Server-1` can communicate with `Node-Server-2`.
- **Database:** Use MongoDB Atlas. Whitelist your Oracle VCN's NAT Gateway IP.

---

## PART 3: AWS and Google Cloud Setup (Overview)

While possible, **proceed with caution** on AWS/GCP due to egress bandwidth costs for video (AWS charges ~$0.09 per GB, which adds up to thousands of dollars fast for 300 concurrent video users).

### AWS
1. **Jitsi (Video):** 
   - Master Node: `t3.medium` EC2 instance.
   - JVB Nodes: `c6g.xlarge` (Compute-optimized ARM) instances in an Auto-Scaling Group based on network out.
   - Open UDP 10000 in Security Groups.
2. **Node.js App:**
   - Application Load Balancer (ALB) with Stickiness enabled.
   - Auto Scaling Group with `t3.medium` instances.
   - Amazon ElastiCache for Redis.

### Google Cloud (GCP)
1. **Jitsi (Video):**
   - Master Node: `e2-medium`.
   - JVB Nodes: `c2-standard-4` instances.
   - Open UDP 10000 in VPC Firewall rules.
2. **Node.js App:**
   - Global HTTP(S) Load Balancer with Session Affinity (Generated Cookie) enabled.
   - Managed Instance Groups (MIG) for Node.js servers.
   - Google Cloud Memorystore for Redis.

---

## Final Scalability Checklist (200-300 Users)

- [ ] **Split Jitsi Architecture:** Ensure you have 1 Master Node and at least 2 dedicated JVB nodes.
- [ ] **Network Egress:** You selected Oracle Cloud or have a high budget for AWS/GCP bandwidth.
- [ ] **UDP 10000:** Confirmed open on the firewall for JVB nodes.
- [ ] **Redis Adapter:** Implemented in Node.js for Socket.io cross-server communication.
- [ ] **Sticky Sessions:** Enabled on the Load Balancer for the Node.js backend.
- [ ] **JWT Auth:** Configure your self-hosted Jitsi Prosody server to accept JWT tokens generated by your Node.js backend.
