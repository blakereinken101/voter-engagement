import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://thresholdvote.com'
  return [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/demo`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/sign-in`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/sign-up`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
}
