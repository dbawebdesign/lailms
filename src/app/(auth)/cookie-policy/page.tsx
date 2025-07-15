import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Cookie Policy | Learnology AI',
  description: 'Cookie Policy for Learnology AI - How we use cookies and tracking technologies',
}

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header with Logo */}
        <div className="flex justify-center mb-8">
          <Link href="/">
            <Image 
              src="/Horizontal black text.png"
              alt="Learnology AI Logo"
              width={300}
              height={80}
              priority
              className="dark:hidden"
            />
            <Image 
              src="/Horizontal white text.png"
              alt="Learnology AI Logo"
              width={300}
              height={80}
              priority
              className="hidden dark:block"
            />
          </Link>
        </div>

        {/* Cookie Policy Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-center mb-8">
            COOKIE POLICY
          </h1>
          
          <div className="space-y-6 text-sm leading-relaxed">
            <p>
              <strong>Effective Date:</strong> January 1, 2025
            </p>
            
            <p>
              This Cookie Policy explains how <strong>TERROIR TECHNOLOGY COMPANY</strong> doing business as <strong>Learnology AI</strong> ("we," "us," or "our") uses cookies and similar tracking technologies on our website and services.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and enabling certain functionality.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. Types of Cookies We Use</h2>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">Essential Cookies</h3>
            <p>
              These cookies are necessary for our website to function properly and cannot be disabled. They include:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Authentication cookies to keep you logged in</li>
              <li>Security cookies to protect against fraud</li>
              <li>Session cookies to maintain your preferences</li>
              <li>Load balancing cookies to ensure optimal performance</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3">Analytics Cookies</h3>
            <p>
              These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Google Analytics cookies to track website usage</li>
              <li>Performance monitoring cookies</li>
              <li>User behavior analysis cookies</li>
              <li>Error tracking cookies</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3">Functional Cookies</h3>
            <p>
              These cookies enhance your experience by remembering your choices and preferences:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Language preference cookies</li>
              <li>Theme and display preference cookies</li>
              <li>Accessibility settings cookies</li>
              <li>User interface customization cookies</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3">Marketing Cookies</h3>
            <p>
              These cookies may be used to deliver personalized content and advertisements:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Advertising preference cookies</li>
              <li>Social media integration cookies</li>
              <li>Conversion tracking cookies</li>
              <li>Remarketing cookies</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Third-Party Cookies</h2>
            <p>
              We may use third-party services that set their own cookies, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Google Analytics:</strong> For website analytics and performance monitoring</li>
              <li><strong>Stripe:</strong> For payment processing and fraud prevention</li>
              <li><strong>Calendly:</strong> For appointment scheduling functionality</li>
              <li><strong>Social Media Platforms:</strong> For content sharing and social login features</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. How Long Do Cookies Last?</h2>
            <p>
              Cookies may be either:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Session cookies:</strong> Temporary cookies that are deleted when you close your browser</li>
              <li><strong>Persistent cookies:</strong> Cookies that remain on your device for a set period or until you delete them</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Managing Your Cookie Preferences</h2>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">Browser Settings</h3>
            <p>
              You can control cookies through your browser settings:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Block all cookies</li>
              <li>Allow only first-party cookies</li>
              <li>Delete existing cookies</li>
              <li>Set preferences for specific websites</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3">Opt-Out Options</h3>
            <p>
              You can opt out of certain tracking cookies:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Google Analytics: <a href="https://tools.google.com/dlpage/gaoptout" className="text-blue-600 hover:underline">Google Analytics Opt-out</a></li>
              <li>Advertising cookies: <a href="http://www.aboutads.info/choices/" className="text-blue-600 hover:underline">Digital Advertising Alliance</a></li>
              <li>Network Advertising Initiative: <a href="http://www.networkadvertising.org/choices/" className="text-blue-600 hover:underline">NAI Opt-out</a></li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Impact of Disabling Cookies</h2>
            <p>
              Disabling cookies may affect your experience on our website:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>You may need to log in repeatedly</li>
              <li>Your preferences may not be saved</li>
              <li>Some features may not work properly</li>
              <li>Content may not be personalized</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Mobile Devices</h2>
            <p>
              On mobile devices, you can manage cookies and tracking through:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Device settings for advertising preferences</li>
              <li>App-specific privacy settings</li>
              <li>Browser settings within mobile apps</li>
              <li>Operating system privacy controls</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Updates to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our practices or applicable laws. We will notify you of any material changes by posting the updated policy on our website.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. Contact Us</h2>
            <p>
              If you have any questions about this Cookie Policy or our use of cookies, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> zjones@learnologyai.com
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">10. More Information</h2>
            <p>
              For more information about cookies and how to manage them, visit:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li><a href="http://www.allaboutcookies.org/" className="text-blue-600 hover:underline">All About Cookies</a></li>
              <li><a href="http://www.youronlinechoices.eu/" className="text-blue-600 hover:underline">Your Online Choices (EU)</a></li>
              <li><a href="https://www.cookiesandyou.com/" className="text-blue-600 hover:underline">Cookies & You</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
} 