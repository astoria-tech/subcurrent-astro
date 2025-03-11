<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="3.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title><xsl:value-of select="/rss/channel/title"/> RSS Feed</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            background: #f7f9fc;
          }
          h1 {
            background: linear-gradient(to right, #7e22ce, #6366f1);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-fill-color: transparent;
            font-size: 2rem;
            margin-bottom: 0.5rem;
          }
          h2 {
            font-size: 1.5rem;
            margin-top: 2rem;
            margin-bottom: 0.75rem;
          }
          a {
            color: #6366f1;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          .subtitle {
            color: #64748b;
            font-size: 1.1rem;
            margin-bottom: 2rem;
          }
          .item {
            padding: 1.25rem;
            border-radius: 0.5rem;
            margin-bottom: 1.5rem;
            background: white;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          }
          .item-title {
            display: block;
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: #1e293b;
          }
          .item-date {
            color: #64748b;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
            display: block;
          }
          .item-author {
            color: #64748b;
            font-size: 0.875rem;
            margin-bottom: 1rem;
            display: block;
          }
          .explanation {
            background-color: #f1f5f9;
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 2rem;
            font-size: 0.875rem;
            color: #475569;
          }
          .logo {
            font-size: 2.5rem;
            margin-bottom: 1rem;
          }
          footer {
            margin-top: 3rem;
            text-align: center;
            color: #64748b;
            font-size: 0.875rem;
          }
        </style>
      </head>
      <body>
        <h1>
          <xsl:value-of select="/rss/channel/title"/>
        </h1>
        <div class="subtitle">
          <xsl:value-of select="/rss/channel/description"/>
        </div>
        
        <div class="explanation">
          <p>
            This is an RSS feed. Subscribe by copying the URL from the address bar into your RSS reader.
            Learn more at <a href="https://aboutfeeds.com">aboutfeeds.com</a>.
          </p>
        </div>
        
        <h2>Recent Content</h2>
        <xsl:for-each select="/rss/channel/item">
          <div class="item">
            <a class="item-title">
              <xsl:attribute name="href">
                <xsl:value-of select="link"/>
              </xsl:attribute>
              <xsl:value-of select="title"/>
            </a>
            <span class="item-date">
              <xsl:value-of select="pubDate"/>
            </span>
            <span class="item-author">
              By: <xsl:value-of select="author"/>
            </span>
            <div>
              <xsl:value-of select="description" disable-output-escaping="yes"/>
            </div>
          </div>
        </xsl:for-each>
        
        <footer>
          <p>
            RSS feed for <xsl:value-of select="/rss/channel/title"/> · 
            Generated for the Astoria Tech community
          </p>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet> 