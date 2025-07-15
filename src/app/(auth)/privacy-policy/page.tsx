import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Learnology AI',
  description: 'Privacy Policy for Learnology AI - How we collect, use, and protect your information',
}

export default function PrivacyPolicyPage() {
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

        {/* Privacy Policy Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-center mb-8">
            PRIVACY POLICY
          </h1>
          
          <div className="space-y-6 text-sm leading-relaxed">
            <p>
              <strong>Effective Date:</strong> January 1, 2025
            </p>
            
            <p>
              This Privacy Policy describes how <strong>TERROIR TECHNOLOGY COMPANY</strong> doing business as <strong>Learnology AI</strong> ("we," "us," or "our") collects, uses, and protects your information when you use our AI-powered learning management system and related services (the "Service").
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">1. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold mt-6 mb-3">Personal Information</h3>
            <p>
              We may collect personal information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Name, email address, and contact information</li>
              <li>Account credentials and profile information</li>
              <li>Educational institution and role information</li>
              <li>Payment and billing information</li>
              <li>Communications and support requests</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3">Educational Data</h3>
            <p>
              When you use our educational services, we may collect:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Student progress and performance data</li>
              <li>Learning preferences and patterns</li>
              <li>Course materials and submissions</li>
              <li>Assessment results and feedback</li>
              <li>Usage analytics and interaction data</li>
            </ul>

            <h3 className="text-lg font-semibold mt-6 mb-3">Technical Information</h3>
            <p>
              We automatically collect certain technical information, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>IP address and device information</li>
              <li>Browser type and version</li>
              <li>Usage patterns and navigation data</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">2. How We Use Your Information</h2>
            <p>
              We use your information to:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and improve our educational services</li>
              <li>Personalize learning experiences and content</li>
              <li>Process payments and manage accounts</li>
              <li>Communicate with you about our services</li>
              <li>Analyze usage patterns and improve our platform</li>
              <li>Comply with legal obligations and protect our rights</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">3. Information Sharing</h2>
            <p>
              We do not sell, trade, or rent your personal information to third parties. We may share information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>With your consent or at your direction</li>
              <li>With educational institutions you are affiliated with</li>
              <li>With service providers who assist in our operations</li>
              <li>To comply with legal obligations or protect our rights</li>
              <li>In connection with a business transaction or merger</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">5. Student Privacy</h2>
            <p>
              We are committed to protecting student privacy and comply with applicable educational privacy laws, including FERPA and COPPA. We do not use student data for advertising or marketing purposes.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">6. Your Rights</h2>
            <p>
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Access to your personal information</li>
              <li>Correction of inaccurate information</li>
              <li>Deletion of your personal information</li>
              <li>Portability of your data</li>
              <li>Objection to processing</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4">7. Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. You can control cookie settings through your browser preferences.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">8. Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide our services and fulfill the purposes outlined in this policy, unless a longer retention period is required by law.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">9. International Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your information during such transfers.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on our website and updating the effective date.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> zjones@learnologyai.com
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 