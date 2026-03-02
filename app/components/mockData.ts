export type MockEvent = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  points: number;
  tag: string;
};

export type MockPost = {
  id: string;
  title: string;
  category: "Announcement" | "Event" | "Culture" | "Ops";
  createdAt: string;
  excerpt: string;
  body: string;
};

export type MockShopItem = {
  id: string;
  name: string;
  category: "Food" | "Merch" | "Lifestyle" | "Experience";
  points: number;
  stock: number;
  highlight: string;
  details: string;
};

export const upcomingEvents: MockEvent[] = [
  {
    id: "event-1",
    title: "Reignite Townhall",
    startsAt: "Mar 05, 9:00 AM",
    location: "Main Floor - Newtown",
    points: 20,
    tag: "Leadership",
  },
  {
    id: "event-2",
    title: "Friday Wellness Stretch",
    startsAt: "Mar 07, 4:30 PM",
    location: "Pantry Hub",
    points: 10,
    tag: "Wellness",
  },
  {
    id: "event-3",
    title: "Client Playbook Refresh",
    startsAt: "Mar 10, 2:00 PM",
    location: "Room Atlas",
    points: 15,
    tag: "Training",
  },
  {
    id: "event-4",
    title: "Recognition Night",
    startsAt: "Mar 14, 6:00 PM",
    location: "Sky Hall",
    points: 25,
    tag: "Culture",
  },
];

export const updatesFeed: MockPost[] = [
  {
    id: "post-1",
    title: "March Site Schedule Update",
    category: "Announcement",
    createdAt: "2h ago",
    excerpt: "Updated floor rotation and shuttle windows are now posted.",
    body: "Updated floor rotation and shuttle windows are now posted. Please review your team cluster schedule before Monday. Supervisors will handle exceptions by Friday noon. Check-in desks open 15 minutes earlier this week to avoid lobby queueing.",
  },
  {
    id: "post-2",
    title: "Reignite: Registration Opens",
    category: "Event",
    createdAt: "5h ago",
    excerpt: "The Reignite event code and venue QR will go live tomorrow.",
    body: "The Reignite event code and venue QR will go live tomorrow. Attendance points will be credited within event window only: 30 minutes before and 60 minutes after start. Bring your company ID and check your profile QR before coming in.",
  },
  {
    id: "post-3",
    title: "Recognition Highlights",
    category: "Culture",
    createdAt: "Yesterday",
    excerpt: "Last month\'s top performers are now featured in the wall.",
    body: "Last month\'s top performers are now featured in the wall. We are also launching peer shout-outs in the chat panel next week. Share one concrete behavior and one measurable impact when posting a recognition note.",
  },
  {
    id: "post-4",
    title: "System Maintenance Reminder",
    category: "Ops",
    createdAt: "2d ago",
    excerpt: "Rewards redemption API maintenance on Saturday, 10 PM to 12 AM.",
    body: "Rewards redemption API maintenance on Saturday, 10 PM to 12 AM. During this window, browsing still works but checkout is paused. QR scans will queue and sync once service resumes. No manual follow-up needed unless your points do not reflect after 30 minutes.",
  },
];

export const shopItems: MockShopItem[] = [
  {
    id: "reward-1",
    name: "Coffee Voucher",
    category: "Food",
    points: 120,
    stock: 40,
    highlight: "Brew Pass",
    details: "Redeem one handcrafted drink at partner cafes near Newtown.",
  },
  {
    id: "reward-2",
    name: "NEXT Hoodie",
    category: "Merch",
    points: 500,
    stock: 16,
    highlight: "Core Fit",
    details: "Premium fleece hoodie with embroidered NEXT mark.",
  },
  {
    id: "reward-3",
    name: "Desk Wellness Kit",
    category: "Lifestyle",
    points: 260,
    stock: 24,
    highlight: "Focus Pack",
    details: "Ergo ball, mini resistance band, and cooling eye mask.",
  },
  {
    id: "reward-4",
    name: "Movie Night Pass",
    category: "Experience",
    points: 340,
    stock: 20,
    highlight: "Weekend",
    details: "Two standard tickets for partner cinemas.",
  },
  {
    id: "reward-5",
    name: "Meal Combo Card",
    category: "Food",
    points: 220,
    stock: 30,
    highlight: "Lunch Plus",
    details: "One combo meal voucher for selected stores.",
  },
  {
    id: "reward-6",
    name: "Wireless Mouse",
    category: "Lifestyle",
    points: 420,
    stock: 14,
    highlight: "Tech",
    details: "Compact wireless mouse for office and remote work.",
  },
  {
    id: "reward-7",
    name: "Cap + Lanyard Set",
    category: "Merch",
    points: 180,
    stock: 36,
    highlight: "Crew",
    details: "NEXT cap plus branded lanyard set.",
  },
  {
    id: "reward-8",
    name: "Team Bowling Slot",
    category: "Experience",
    points: 600,
    stock: 8,
    highlight: "Group",
    details: "One lane slot for your team-building session.",
  },
];

export const hotItems = shopItems.slice(0, 5);

export const shopFilters: Array<"All" | MockShopItem["category"]> = [
  "All",
  "Food",
  "Merch",
  "Lifestyle",
  "Experience",
];
