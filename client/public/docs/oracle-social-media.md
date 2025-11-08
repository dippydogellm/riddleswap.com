# Oracle Social Media System
## AI-Powered Automation, News Feeds & Community Engagement

**Version 1.0** | **October 2025**

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Twitter Integration](#twitter-integration)
3. [Telegram Integration](#telegram-integration)
4. [AI Engagement Engine](#ai-engagement-engine)
5. [Swap Activity Announcements](#swap-activity-announcements)
6. [News Feeds & Profiles](#news-feeds-profiles)
7. [Oracle Terminal Dashboard](#oracle-terminal-dashboard)
8. [Configuration & Setup](#configuration-setup)
9. [Analytics & Reporting](#analytics-reporting)
10. [Best Practices](#best-practices)

---

## Executive Summary

The Oracle Social Media System leverages GPT-5 AI to automate and enhance RiddleSwap's social media presence across Twitter and Telegram. From intelligent engagement to automated swap announcements, the Oracle handles community management at scale.

### Key Features

- **Twitter Automation**: Auto-posting, engagement monitoring, smart replies
- **Telegram Bot**: Real-time announcements and community interaction
- **AI Engagement**: GPT-5 powered response generation with sentiment analysis
- **Swap Announcements**: Automated whale trade alerts ($10k+ USD)
- **News Feeds**: Public API for latest platform news and profiles
- **Oracle Terminal**: Real-time monitoring dashboard

### AI Capabilities

- **Powered by GPT-5**: Latest OpenAI model for contextual responses
- **Sentiment Analysis**: Understand user intent and emotion
- **Smart Auto-Reply**: Approval workflow for AI-generated responses
- **Content Generation**: Automated post creation and scheduling
- **Keyword Monitoring**: Track mentions and relevant discussions

---

## Twitter Integration

### Automated Posting

**Post Types**

```typescript
interface TwitterPost {
  type: 'announcement' | 'whale_alert' | 'market_update' | 'engagement';
  content: string;
  mediaUrls?: string[];
  scheduledAt?: Date;
  hashtags: string[];
}
```

**Example Announcement Post**

```javascript
const postAnnouncement = async (announcement) => {
  const tweet = {
    text: `🎮 ${announcement.title}\n\n${announcement.description}\n\n#RiddleSwap #DeFi #XRPL`,
    media: announcement.imageUrl ? [announcement.imageUrl] : undefined
  };
  
  const result = await twitterClient.v2.tweet(tweet);
  
  // Log to database
  await db.insert(socialMediaPosts).values({
    platform: 'twitter',
    type: 'announcement',
    content: tweet.text,
    postId: result.data.id,
    postedAt: new Date()
  });
  
  return result;
};
```

### Engagement Monitoring

**Keyword Tracking**

```javascript
const MONITORED_KEYWORDS = [
  'riddleswap',
  '@riddleswap',
  'rdl token',
  'trolls inquisition',
  'xrpl swap',
  'multi-chain defi'
];

const monitorTwitterMentions = async () => {
  // Search for mentions
  const stream = await twitterClient.v2.searchStream({
    'tweet.fields': ['created_at', 'author_id', 'text'],
    expansions: ['author_id']
  });
  
  stream.on('data', async (tweet) => {
    // Analyze sentiment
    const sentiment = await analyzeSentiment(tweet.data.text);
    
    // Store for review
    await db.insert(socialMediaMentions).values({
      platform: 'twitter',
      tweetId: tweet.data.id,
      authorId: tweet.data.author_id,
      content: tweet.data.text,
      sentiment: sentiment.score,
      processedAt: new Date()
    });
    
    // Generate AI response if appropriate
    if (shouldRespond(tweet, sentiment)) {
      await generateAIResponse(tweet);
    }
  });
};
```

### Auto-Reply System

**Smart Response Generation**

```javascript
const generateAIResponse = async (tweet) => {
  // Get context
  const context = {
    tweet: tweet.data.text,
    author: tweet.includes.users[0].username,
    sentiment: await analyzeSentiment(tweet.data.text),
    previousInteractions: await getPreviousInteractions(tweet.data.author_id)
  };
  
  // Generate response with GPT-5
  const response = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      {
        role: 'system',
        content: `You are the Oracle, RiddleSwap's AI assistant. Respond helpfully and professionally to this tweet. Keep responses under 280 characters. Use appropriate emojis sparingly.`
      },
      {
        role: 'user',
        content: `Tweet: "${tweet.data.text}"\n\nSentiment: ${context.sentiment.label}\n\nGenerate an appropriate response.`
      }
    ],
    temperature: 0.7,
    max_tokens: 100
  });
  
  const aiReply = response.choices[0].message.content;
  
  // Submit for approval
  await db.insert(pendingReplies).values({
    tweetId: tweet.data.id,
    generatedReply: aiReply,
    status: 'pending_approval',
    createdAt: new Date()
  });
  
  return aiReply;
};
```

**Approval Workflow**

```javascript
const approveReply = async (replyId) => {
  const reply = await db.query.pendingReplies.findFirst({
    where: eq(pendingReplies.id, replyId)
  });
  
  if (!reply) return;
  
  // Post reply
  const result = await twitterClient.v2.reply(
    reply.generatedReply,
    reply.tweetId
  );
  
  // Update status
  await db.update(pendingReplies)
    .set({
      status: 'approved',
      postedAt: new Date(),
      twitterReplyId: result.data.id
    })
    .where(eq(pendingReplies.id, replyId));
  
  return result;
};
```

### Automated Likes & Retweets

**Engagement Rules**

```javascript
const autoEngagement = async (tweet, sentiment) => {
  // Auto-like if positive sentiment
  if (sentiment.score > 0.7) {
    await twitterClient.v2.like(userAuth, tweet.data.id);
  }
  
  // Auto-retweet if highly relevant and positive
  if (sentiment.score > 0.8 && isHighlyRelevant(tweet)) {
    await twitterClient.v2.retweet(userAuth, tweet.data.id);
  }
  
  // Log engagement
  await db.insert(socialMediaEngagements).values({
    platform: 'twitter',
    tweetId: tweet.data.id,
    action: 'like',
    automated: true,
    createdAt: new Date()
  });
};
```

---

## Telegram Integration

### Bot Setup

**Telegram Bot Commands**

```javascript
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    '🤖 Welcome to RiddleSwap Oracle Bot!\n\n' +
    'Commands:\n' +
    '/price [token] - Get token price\n' +
    '/swap [from] [to] [amount] - Get swap quote\n' +
    '/trending - View trending tokens\n' +
    '/help - Show all commands'
  );
});

bot.onText(/\/price (.+)/, async (msg, match) => {
  const token = match[1];
  const price = await getTokenPrice(token);
  
  bot.sendMessage(msg.chat.id,
    `💰 ${token.toUpperCase()}\n` +
    `Price: $${price.usd}\n` +
    `24h: ${price.change24h > 0 ? '📈' : '📉'} ${price.change24h}%`
  );
});
```

### Channel Announcements

**Automated Announcements**

```javascript
const sendTelegramAnnouncement = async (announcement) => {
  const message = `
🔔 **${announcement.title}**

${announcement.description}

${announcement.link ? `🔗 [Learn More](${announcement.link})` : ''}

#RiddleSwap #DeFi
  `;
  
  await bot.sendMessage(
    process.env.TELEGRAM_CHANNEL_ID,
    message,
    { parse_mode: 'Markdown' }
  );
  
  // Log announcement
  await db.insert(socialMediaPosts).values({
    platform: 'telegram',
    type: 'announcement',
    content: message,
    channelId: process.env.TELEGRAM_CHANNEL_ID,
    postedAt: new Date()
  });
};
```

### Interactive Features

**Price Alerts**

```javascript
bot.onText(/\/alert (.+) (.+)/, async (msg, match) => {
  const [token, targetPrice] = match.slice(1);
  
  await db.insert(priceAlerts).values({
    userId: msg.from.id,
    token: token,
    targetPrice: parseFloat(targetPrice),
    platform: 'telegram',
    chatId: msg.chat.id,
    active: true
  });
  
  bot.sendMessage(msg.chat.id,
    `✅ Alert set for ${token} at $${targetPrice}`
  );
});

// Monitor and trigger alerts
setInterval(async () => {
  const alerts = await getActiveAlerts();
  
  for (const alert of alerts) {
    const currentPrice = await getTokenPrice(alert.token);
    
    if (currentPrice >= alert.targetPrice) {
      await bot.sendMessage(alert.chatId,
        `🔔 PRICE ALERT!\n${alert.token} reached $${currentPrice}`
      );
      
      await deactivateAlert(alert.id);
    }
  }
}, 60000); // Check every minute
```

---

## AI Engagement Engine

### Sentiment Analysis

**GPT-5 Sentiment Detection**

```javascript
const analyzeSentiment = async (text) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      {
        role: 'system',
        content: 'Analyze the sentiment of the following text. Respond with a JSON object containing: score (-1 to 1), label (negative, neutral, positive), and topics (array of mentioned topics).'
      },
      {
        role: 'user',
        content: text
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content);
};
```

**Example Analysis**

```javascript
Input: "RiddleSwap is amazing! Best multi-chain swap platform!"

Output:
{
  "score": 0.95,
  "label": "positive",
  "topics": ["riddleswap", "multi-chain", "swap platform"],
  "emotion": "enthusiastic",
  "actionable": false
}
```

### Smart Auto-Reply

**Context-Aware Responses**

```javascript
const generateContextualReply = async (tweet, userHistory) => {
  const systemPrompt = `
You are the Oracle, RiddleSwap's AI assistant.

User History:
- Previous interactions: ${userHistory.interactions}
- Sentiment: ${userHistory.averageSentiment}
- Topics discussed: ${userHistory.topics.join(', ')}

Guidelines:
1. Be helpful and professional
2. Provide accurate information about RiddleSwap
3. Direct complex questions to support
4. Use 1-2 emojis maximum
5. Keep under 280 characters
6. Match the user's tone (formal/casual)
  `;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: tweet.text }
    ],
    temperature: 0.7
  });
  
  return response.choices[0].message.content;
};
```

### Topic Categorization

**Automatic Topic Detection**

```javascript
const categorizeTopic = async (text) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      {
        role: 'system',
        content: 'Categorize this message into one or more categories: swap, bridge, nft, gaming, support, general. Return JSON array.'
      },
      {
        role: 'user',
        content: text
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(response.choices[0].message.content).categories;
};
```

---

## Swap Activity Announcements

### Whale Trade Detection

**Monitoring XRPL for RDL Swaps**

```javascript
const monitorRDLSwaps = async () => {
  const client = new xrpl.Client('wss://xrplcluster.com');
  await client.connect();
  
  client.on('transaction', async (tx) => {
    // Check if it's a payment involving RDL
    if (tx.transaction.TransactionType === 'Payment' &&
        isRDLToken(tx.transaction.Amount)) {
      
      const amountUSD = await convertToUSD(tx.transaction.Amount);
      
      // Whale threshold: $10k+
      if (amountUSD >= 10000) {
        await announceWhaleSwap(tx, amountUSD);
      }
    }
  });
};
```

**Announcement Generation**

```javascript
const announceWhaleSwap = async (tx, amountUSD) => {
  const amount = parseAmount(tx.transaction.Amount);
  
  // Generate announcement
  const announcement = `
🐋 WHALE ALERT! 🐋

${formatNumber(amount)} RDL swapped
💰 Value: $${formatNumber(amountUSD)}

Transaction: ${tx.transaction.hash.substring(0, 16)}...

#RiddleSwap #RDLToken #WhaleAlert
  `;
  
  // Post to Twitter
  await twitterClient.v2.tweet({ text: announcement });
  
  // Post to Telegram
  await bot.sendMessage(
    process.env.TELEGRAM_CHANNEL_ID,
    announcement
  );
  
  // Log announcement
  await db.insert(swapAnnouncements).values({
    txHash: tx.transaction.hash,
    amount: amount.toString(),
    amountUSD: amountUSD,
    postedTwitter: true,
    postedTelegram: true,
    createdAt: new Date()
  });
};
```

### Rate Limiting

**Prevent Spam**

```javascript
const ANNOUNCEMENT_CONFIG = {
  minAmount: 10000, // $10k minimum
  cooldownPeriod: 300000, // 5 minutes between announcements
  maxPerHour: 12
};

const shouldAnnounce = async (amountUSD) => {
  // Check minimum amount
  if (amountUSD < ANNOUNCEMENT_CONFIG.minAmount) {
    return false;
  }
  
  // Check cooldown
  const lastAnnouncement = await getLastAnnouncement();
  if (Date.now() - lastAnnouncement.createdAt < ANNOUNCEMENT_CONFIG.cooldownPeriod) {
    return false;
  }
  
  // Check hourly limit
  const recentCount = await getAnnouncementCount(3600000); // Last hour
  if (recentCount >= ANNOUNCEMENT_CONFIG.maxPerHour) {
    return false;
  }
  
  return true;
};
```

---

## News Feeds & Profiles

### Public News Feed API

**Latest Platform News**

```javascript
GET /api/social/news

Query Parameters:
- limit: number (default: 20)
- offset: number (default: 0)
- category: 'announcement' | 'update' | 'event'

Response:
{
  "success": true,
  "news": [
    {
      "id": 1,
      "title": "New Swap Feature Launched",
      "description": "Multi-chain swap now supports Solana",
      "category": "announcement",
      "imageUrl": "https://...",
      "publishedAt": "2025-10-26T12:00:00Z",
      "author": "RiddleSwap Team"
    }
  ],
  "total": 150,
  "hasMore": true
}
```

### Player Profiles

**Public Gaming Profiles**

```javascript
GET /api/social/profile/:handle

Response:
{
  "success": true,
  "profile": {
    "handle": "warrior123",
    "joinedAt": "2025-01-15T00:00:00Z",
    "stats": {
      "totalPower": 5000,
      "wins": 42,
      "losses": 15,
      "winRate": 73.68,
      "rank": 150
    },
    "nftCollections": [
      {
        "name": "RiddleTrolls",
        "count": 5,
        "totalPower": 2500
      }
    ],
    "achievements": [
      {
        "badge": "First Victory",
        "earnedAt": "2025-01-20T00:00:00Z"
      }
    ],
    "aiGeneratedImage": "https://..."
  }
}
```

### Social Media Links

**Share Profiles**

```javascript
const generateProfileShareText = (profile) => {
  return `
⚔️ Check out my RiddleSwap profile!

🏆 Rank: #${profile.stats.rank}
💪 Power: ${profile.stats.totalPower}
🎯 Win Rate: ${profile.stats.winRate}%

Join the battle: https://riddleswap.com/profile/${profile.handle}

#RiddleSwap #TrollsInquisition
  `;
};
```

---

## Oracle Terminal Dashboard

### Real-Time Monitoring

**Dashboard Features**

```typescript
interface OracleTerminalDashboard {
  twitter: {
    mentions: number;
    pendingReplies: number;
    todayPosts: number;
    engagement: {
      likes: number;
      retweets: number;
      replies: number;
    };
  };
  telegram: {
    messages: number;
    activeUsers: number;
    alertsSent: number;
  };
  swapAnnouncements: {
    today: number;
    totalValue: number;
    largestSwap: number;
  };
  aiMetrics: {
    repliesGenerated: number;
    approvalRate: number;
    averageSentiment: number;
  };
}
```

**Live Updates via WebSocket**

```javascript
const ws = new WebSocket('wss://api.riddleswap.com/ws/oracle-terminal');

ws.on('message', (data) => {
  const update = JSON.parse(data);
  
  switch(update.type) {
    case 'new_mention':
      updateMentionsCount(update.data);
      break;
    case 'pending_reply':
      addPendingReply(update.data);
      break;
    case 'whale_swap':
      displayWhaleAlert(update.data);
      break;
    case 'engagement_update':
      updateEngagementMetrics(update.data);
      break;
  }
});
```

### Analytics View

**Performance Metrics**

```javascript
GET /api/social/analytics

Query Parameters:
- startDate: ISO date
- endDate: ISO date
- platform: 'twitter' | 'telegram' | 'all'

Response:
{
  "success": true,
  "analytics": {
    "posts": 150,
    "reach": 50000,
    "engagement": 2500,
    "engagementRate": 5.0,
    "sentimentBreakdown": {
      "positive": 75,
      "neutral": 20,
      "negative": 5
    },
    "topPerformingPosts": [...]
  }
}
```

---

## Configuration & Setup

### Environment Variables

```bash
# Twitter API
TWITTER_API_KEY=your_key
TWITTER_API_SECRET=your_secret
TWITTER_ACCESS_TOKEN=your_token
TWITTER_ACCESS_SECRET=your_token_secret

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHANNEL_ID=@your_channel

# OpenAI
OPENAI_API_KEY=sk-...

# Oracle Settings
ORACLE_AUTO_REPLY_ENABLED=true
ORACLE_MIN_SENTIMENT_FOR_LIKE=0.7
ORACLE_WHALE_THRESHOLD_USD=10000
```

### Database Schema

```sql
CREATE TABLE social_media_posts (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  post_id VARCHAR(255),
  media_urls TEXT[],
  posted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE social_media_mentions (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  mention_id VARCHAR(255) NOT NULL,
  author_id VARCHAR(255),
  content TEXT NOT NULL,
  sentiment DECIMAL(3,2),
  processed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pending_replies (
  id SERIAL PRIMARY KEY,
  mention_id VARCHAR(255) NOT NULL,
  generated_reply TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending_approval',
  approved_by VARCHAR(255),
  posted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Analytics & Reporting

### Engagement Reports

**Weekly Summary**

```javascript
const generateWeeklySummary = async () => {
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const [posts, mentions, replies] = await Promise.all([
    getPostCount(startDate),
    getMentionCount(startDate),
    getReplyCount(startDate)
  ]);
  
  const engagement = await getEngagementMetrics(startDate);
  const sentiment = await getAverageSentiment(startDate);
  
  return {
    period: 'weekly',
    posts: posts,
    mentions: mentions,
    replies: replies,
    engagement: {
      likes: engagement.likes,
      retweets: engagement.retweets,
      rate: (engagement.total / posts) * 100
    },
    sentiment: {
      average: sentiment.average,
      positive: sentiment.positive,
      neutral: sentiment.neutral,
      negative: sentiment.negative
    }
  };
};
```

### Top Performing Content

**Identify Successful Posts**

```javascript
const getTopPosts = async (limit = 10) => {
  const posts = await db.query.socialMediaPosts.findMany({
    orderBy: desc(socialMediaPosts.engagementScore),
    limit: limit
  });
  
  return posts.map(post => ({
    content: post.content,
    platform: post.platform,
    engagement: post.engagementScore,
    reach: post.impressions,
    postedAt: post.postedAt
  }));
};
```

---

## Best Practices

### Content Strategy

**1. Posting Schedule**
- Morning (9-11 AM): Market updates, trending tokens
- Afternoon (1-3 PM): Educational content, tips
- Evening (7-9 PM): Community engagement, gaming updates
- Weekend: Highlights, announcements

**2. Content Mix**
- 40% Educational (how-to, guides)
- 30% Engagement (questions, polls)
- 20% Announcements (updates, features)
- 10% Entertainment (memes, community content)

### Engagement Guidelines

**Do's**
- ✅ Respond to mentions within 1 hour
- ✅ Personalize responses
- ✅ Use emojis appropriately
- ✅ Acknowledge feedback
- ✅ Share community content

**Don'ts**
- ❌ Auto-reply to complaints without human review
- ❌ Post more than 10 times per day
- ❌ Use excessive hashtags
- ❌ Ignore negative sentiment
- ❌ Make promises without authorization

### AI Safety

**Review All AI Responses**

```javascript
const requiresHumanReview = (reply, sentiment) => {
  return (
    sentiment.score < -0.3 ||  // Negative sentiment
    containsSensitiveTopics(reply) ||
    mentionsPricing(reply) ||
    containsFinancialAdvice(reply)
  );
};
```

---

## Conclusion

The Oracle Social Media System transforms RiddleSwap's community engagement through AI-powered automation, real-time swap announcements, and intelligent content management. By leveraging GPT-5 and robust analytics, we maintain an active, responsive, and authentic social media presence at scale.

---

## Resources

- [Platform Overview](./platform-overview.md)
- [Developer Tools](./developer-tools.md)
- [Oracle Terminal Dashboard](https://riddleswap.com/oracle-terminal)

---

**Document Version**: 1.0  
**Last Updated**: October 26, 2025  
**Author**: RiddleSwap Development Team
