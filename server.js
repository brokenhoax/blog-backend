const express = require("express");
const fs = require("fs");
const https = require("https");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: "https://krauscloud.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// setup static server
// app.use(express.static(path.join(__dirname, "public")));

// setup individual routes
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "public", "index.html"));
// });

// Load certs
const options = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
};
// Posts Database (move to PostgreSQL in Production)
let posts = [
  {
    id: "5",
    title: "Lab 3 — Switch",
    date: "2-16-2025",
    length: {
      minutes: "40",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 4,
    tagline: "Connect your network.",
    path: "/pages/switch",
    imagePath: "/images/infrared-eye.webp",
    imageAltText: "Infrared eye.",
    priority: true,
    previewText: `Our Netgate security appliance comes with four wired ethernet
      interfaces, but one is already in use as our uplink and the other
      three aren't enough to meet our lab's needs. We're going to need
      more interfaces so we'll be connecting an 8-port (interface)
      gigabit ethernet switch to our firewall in this post. In fact, we'll be
      doing a lot more than just connecting our switch to our firewall. 
      Other objectives include dividing our ten (10) physical interfaces
      into five (5) separate Virtual Local Area Networks (VLANs), disabling 
      inter-VLAN routing, hardening our switch, and backing up our configuration.
      `,
  },
  {
    id: "4",
    title: "Lab 2 — pfSense",
    date: "11-15-2024",
    length: {
      minutes: "60",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 4,
    tagline: "Secure your network.",
    path: "/pages/pfsense",
    imagePath: "/images/fire.webp",
    imageAltText: "Flame",
    priority: true,
    previewText: `pfSense running on a Netgate 4200 appliance not only provides our
      lab with network security, but it will also serve as our lab's
      core router. pfSense also boasts a lot of other functionality that
      we'll be leveraging throughout this series and beyond. The best
      part, pfSense is completely free and open source! This post is a
      bit on the longer side, but hang in there because it's chock-full
      of good stuff that's at the foundation of our home lab and core to
      learning networking and cybersecurity.`,
  },
  {
    id: "3",
    title: "Lab 1 — Gear Up",
    date: "10-31-2024",
    length: {
      minutes: "10",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 2,
    tagline: "Building a home lab? Let's gear up.",
    path: "/pages/lab-components",
    imagePath: "/images/sparkle.webp",
    imageAltText: "Sparkle",
    priority: true,
    previewText: `By the end of this lab, you will have built your own personal
      cloud consisting of a virtualization server to run your applications, a security appliance
      to help ensure your network is locked down, a network switch
      virtualized into four separate virtual networks, and an endless
      number of possibitlies for how to use your home lab. It's not much
      of a cloud if you don't have a presence on the web, so this lab
      will also include guidance on how to build a NextJS web app and
      deploy it on your own NGINX web server. Start thinking of a name
      for your cloud and review the rundown of required components
      listed below. Let's gear up and go!`,
  },
  {
    id: "2",
    title: "Figma Slider",
    date: "7-14-2022",
    length: {
      minutes: "15",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 3,
    tagline: "Create a range slider in Figma.",
    path: "/pages/figma-slider",
    imagePath: "/images/spring.webp",
    imageAltText: "Spring",
    priority: true,
    unoptomized: true,
    previewText: `I'm building a mockup in Figma for a new feature at work and I've
      been asked to include a range slider that allows a user to change
      "synonym sensitivity" on a scale from 1 to 100. I figured building a
      slider in Figma would be a worthy challenge and one worth sharing.
      What's more, this tutorial will expose you to highly useful Figma
      concepts such as components/variants, constraints, interactions, and
      basic styling. Let's jump in!`,
  },
  {
    id: "1",
    title: "Ready Set Go",
    date: "6-3-2021",
    length: {
      minutes: "10",
      seconds: "00",
    },
    icon: "fas fa-mug-hot",
    mugs: 2,
    tagline: "Publish your app with GitHub Pages.",
    path: "/pages/ready-set-go",
    imagePath: "/images/code.webp",
    imageAltText: "Code",
    priority: true,
    previewText: `So, you've dabbled with create-react-app and you're ready to build and share something amazing with the world. Now what? This post will walk you through creating a GitHub repository to manage and back up your application as well as using GitHub Pages to publish your app to the web.`,
  },
];

//  GET Posts API
app.get("/api/posts", (req, res) => {
  res.json(posts);
});

https.createServer(options, app).listen(8000, "0.0.0.0", () => {
  console.log("HTTPS server running on https://0.0.0.0:8000");
});
