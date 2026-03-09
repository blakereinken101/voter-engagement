/**
 * Seed platform-wide knowledge base articles for the support center.
 */

const crypto = require('crypto')

const articles = [
  {
    title: 'Getting Started with Threshold',
    category: 'general',
    tags: ['getting-started', 'onboarding', 'basics'],
    content: `Welcome to Threshold! Here's how to get up and running:

1. **Create or join a campaign** — After signing up, you'll either create a new campaign or accept an invitation to join an existing one.

2. **Set up your profile** — Add your name and contact info so your team knows who you are.

3. **Explore the dashboard** — Your dashboard is your home base. From here you can manage events, contacts, messaging, and more.

4. **Invite your team** — Campaign admins can invite volunteers and organizers from the Team settings.

5. **Create your first event** — Head to Events to create a canvass, phone bank, fundraiser, or other campaign event.

If you have questions at any point, use this help center or chat with our AI assistant.`,
  },
  {
    title: 'Creating and Managing Events',
    category: 'general',
    tags: ['events', 'canvass', 'phone-bank', 'fundraiser'],
    content: `Events are the core of your campaign organizing. Here's how to create and manage them:

**Creating an Event**
- Go to the Events tab and click "Create Event"
- Choose your event type: Canvass, Phone Bank, Fundraiser, Meeting, Rally, or Other
- Fill in the details: title, description, date/time, and location
- Publish your event to make it visible to your team

**Managing RSVPs**
- Team members can RSVP directly from the event page
- You'll see a list of confirmed, maybe, and declined responses
- Guests can also RSVP without creating an account

**Event Blasts**
- Send messages to all attendees using the Blast feature
- You can send up to 3 blasts per event
- Great for last-minute updates or reminders

**Automatic Reminders**
- Attendees receive email reminders 24 hours and 6 hours before your event
- Event hosts also get a reminder so they can prepare`,
  },
  {
    title: 'Inviting Team Members',
    category: 'general',
    tags: ['team', 'invitations', 'roles', 'volunteers'],
    content: `Build your campaign team by inviting volunteers and organizers.

**How to Invite**
- Go to Team settings from your dashboard
- Enter the person's email address
- Choose their role: Volunteer, Organizer, or Admin
- They'll receive an email invitation with a link to join

**Roles & Permissions**
- **Volunteer** — Can view events, RSVP, and access the contact book
- **Organizer** — Can create events, manage contacts, and send messages
- **Campaign Admin** — Full access including team management and settings
- **Org Owner** — Top-level access across all campaign settings

**Tips**
- People need to create a Threshold account to accept the invitation
- Invitations expire after 7 days but can be resent
- You can change someone's role at any time from Team settings`,
  },
  {
    title: 'Using the Contact Book',
    category: 'general',
    tags: ['contacts', 'voters', 'phone-book', 'outreach'],
    content: `The contact book helps you organize the people your campaign is reaching.

**Adding Contacts**
- Import contacts from your phone (with your permission)
- Manually add people you meet while canvassing
- Contacts from event RSVPs are automatically added

**Organizing Contacts**
- Search and filter your contact list
- View contact details and interaction history
- Track outreach status for each person

**Privacy**
- Contact data is only visible to your campaign team
- Contacts are stored securely and never shared with third parties
- You can delete contacts at any time`,
  },
  {
    title: 'Push Notifications',
    category: 'technical',
    tags: ['notifications', 'push', 'mobile', 'alerts'],
    content: `Stay in the loop with push notifications on your mobile device.

**What You'll Get Notified About**
- New events created by your campaign
- Reminders for upcoming events you've RSVP'd to
- Messages from your campaign team
- Support ticket updates

**Enabling Notifications**
- When you first open the app, you'll be asked to allow notifications
- You can also enable them later in your device's Settings app
- Go to Settings → Threshold → Notifications

**Troubleshooting**
- Make sure notifications are enabled in your device settings
- Check that you're signed in to your campaign
- Try signing out and back in if notifications stop working
- Contact support if issues persist`,
  },
  {
    title: 'Account & Privacy Settings',
    category: 'account',
    tags: ['account', 'privacy', 'settings', 'security', 'data'],
    content: `Manage your account and privacy settings.

**Account Settings**
- Update your name and email from your profile
- Change your password at any time
- Sign out of all devices if needed

**Privacy**
- Your personal information is never sold or shared
- Campaign data is visible only to your campaign team members
- You can request a copy of your data or delete your account at any time

**Data & Security**
- All data is encrypted in transit and at rest
- We use industry-standard security practices
- For our full privacy policy, visit the Privacy page on our website

If you have specific privacy concerns, reach out to us at info@thresholdvote.com.`,
  },
  {
    title: 'Messaging & Team Communication',
    category: 'general',
    tags: ['messaging', 'chat', 'communication', 'channels'],
    content: `Threshold includes built-in messaging so your team can coordinate.

**Channels**
- Campaign admins can create channels for different topics or teams
- All team members can see and participate in public channels
- Use channels for announcements, coordination, and updates

**Direct Messages**
- Send private messages to any team member
- Great for one-on-one coordination

**Tips for Effective Communication**
- Keep channel conversations on-topic
- Use event blasts (not messaging) for attendee communications
- Pin important messages so they're easy to find`,
  },
  {
    title: 'Troubleshooting Common Issues',
    category: 'technical',
    tags: ['troubleshooting', 'bugs', 'issues', 'help'],
    content: `Here are solutions to common issues:

**Can't Sign In**
- Double-check your email address
- Try resetting your password
- Make sure you've verified your email

**Events Not Showing**
- Make sure you're viewing the correct campaign
- Check that the event has been published
- Try refreshing the page

**Not Receiving Emails**
- Check your spam/junk folder
- Add noreply@thresholdvote.com to your contacts
- Verify your email address is correct in your profile

**App Running Slowly**
- Try closing and reopening the app
- Make sure you're on a stable internet connection
- Update to the latest version

**Still Need Help?**
If none of these solutions work, use the "Ask AI" tab or submit a support ticket and we'll get back to you.`,
  },
]

exports.up = async (pgm) => {
  // Find the first platform admin to use as article creator
  const { rows } = await pgm.db.query(
    `SELECT id FROM users WHERE is_platform_admin = true LIMIT 1`
  )

  if (rows.length === 0) {
    console.log('[seed-kb] No platform admin found, skipping KB article seed')
    return
  }

  const adminId = rows[0].id

  for (const article of articles) {
    const id = crypto.randomUUID()
    const slug = article.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .slice(0, 80)

    await pgm.db.query(
      `INSERT INTO kb_articles (id, campaign_id, title, slug, content, category, tags, is_published, created_by)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, true, $7)
       ON CONFLICT DO NOTHING`,
      [id, article.title, slug, article.content, article.category, article.tags, adminId]
    )
  }

  console.log(`[seed-kb] Seeded ${articles.length} platform-wide KB articles`)
}

exports.down = async (pgm) => {
  // Remove only the seeded platform-wide articles
  await pgm.db.query(`DELETE FROM kb_articles WHERE campaign_id IS NULL`)
}
