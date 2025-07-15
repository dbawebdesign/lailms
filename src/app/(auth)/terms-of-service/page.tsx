import { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | Learnology AI',
  description: 'Patent/Intellectual Property License Agreement for Learnology AI',
}

export default function TermsOfServicePage() {
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

        {/* Terms Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          <h1 className="text-3xl font-bold text-center mb-8">
            PATENT/INTELLECTUAL PROPERTY LICENSE AGREEMENT
          </h1>
          
          <div className="space-y-6 text-sm leading-relaxed">
            <p>
              This Agreement is between <strong>TERROIR TECHNOLOGY COMPANY</strong> doing business as <strong>Learnology AI</strong> and referred to herein as <strong>LICENSOR</strong>, and you, referred to herein as <strong>LICENSEE</strong>. By using the software, you accept these terms. If you don't accept them, do not use the software. As described below, use of the software also operates as your consent to the transmission of certain standard computer information during validation, automatic download and installation of certain updates, and for Internet-based services.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">Recitals</h2>
            <p>
              LICENSOR is the exclusive distributor of a proprietary intellectual property known as <strong>"LEARNOLOGY AI"</strong> and related intellectual property (instructions, a website, notes, specs, writings, projections, digital documents and information, drawings, models, plans, engineering, designs, etc.) for and related to said intellectual property, which collectively will be referred to altogether as <strong>"LEARNOLOGY AI"</strong>.
            </p>
            
            <p>
              In consideration of the above recitals and the covenants and agreements contained in this Agreement, the parties agree as follows:
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION ONE - GRANT OF LICENSE</h2>
            <p>
              <strong>A.</strong> LICENSOR grants LICENSEE a nontransferable, non-exclusive, limited license to use the "LEARNOLOGY AI" system and its components, subject to the conditions of this Agreement.
            </p>
            <p>
              <strong>B.</strong> LICENSEE does not receive legal title to the "LEARNOLOGY AI" system, but instead receives a license for LICENSEE'S students and staff to use it as provided under this Agreement.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION TWO - DESCRIPTION OF "LEARNOLOGY AI" SYSTEM; CONFIDENTIALITY</h2>
            <p>
              <strong>A.</strong> The LEARNOLOGY AI System is described on Appendix A, attached to and made part of this Agreement as though fully rewritten here.
            </p>
            <p>
              <strong>B.</strong> <strong>Covenant of Confidentiality:</strong> All information whatsoever concerning the LEARNOLOGY AI System is and shall remain the property of the developer and shall be and remain confidential at all times; and no party, and no person in privity with either party, whether as shareholder, member, manager, Director, Officer, employee, Trustee, agent, spouse, child, independent contractor, joint venturer, administrator, executor, successor, assign, student, administrator, teacher or otherwise shall disclose to any person whomsoever any information about the LEARNOLOGY AI software without the prior, express, written consent of LICENSOR. For violation of this covenant of confidentiality, the parties agree that actual damages may be difficult to prove, and agree that liquidated damages of $1,000 per breach of this covenant, and $1,000 per product sold, licensed, delivered to any person whomsoever by a competitor because of such violation is a reasonable and fair amount to be paid by the person or party breaching this covenant to LICENSOR, and that a person or party who breaches this covenant shall be liable for such liquidated damages to LICENSOR.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION THREE - USE OF LEARNOLOGY AI SYSTEM; ACCESS</h2>
            <p>
              <strong>A.</strong> The parties agree that the LEARNOLOGY AI software is proprietary to TERROIR PROPERTIES, LLC. LICENSEE agrees that the LEARNOLOGY AI software and all related data, whether oral, written, digital, electronic or in any media whatsoever, furnished under this Agreement constitute valuable assets and trade secrets of the developer and are provided for LICENSEE's non-exclusive use for the purposes of this Agreement, and will be held in confidence by LICENSEE.
            </p>
            <p>
              <strong>B.</strong> LICENSEE covenants and agrees not to duplicate or disclose any information provided relative to the LEARNOLOGY AI System in whole or in part, or for the use of others, and to protect such information in the same fashion as it protects its own proprietary or confidential information, except as provided in this Agreement. LICENSEE will not remove any designation mark from any supplied materials that identifies such materials as belonging to LICENSOR.
            </p>
            <p>
              <strong>C.</strong> The LEARNOLOGY AI System is intended to be used by LICENSEE as a learning aid. Any other use of the LEARNOLOGY AI System is strictly prohibited and will constitute a breach of this License Agreement.
            </p>
            <p>
              <strong>D.</strong> LICENSEE, and all those in privity with it may use the LEARNOLOGY AI System on school premises, in each such individual's personal residence, in libraries, laboratories, and other educational locations for school and educational purposes only. No students, administrators, teachers, aids, and all those in privity with LICENSEE who use or access the LEARNOLOGY AI software under this license may share the LEARNOLOGY AI System with any person who is not authorized by this License.
            </p>
            <p>
              <strong>E.</strong> <strong>Access:</strong> LEARNOLOGY AI may be accessed by users on a web and mobile app.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION FOUR - TERM and PROHIBITION ON SALE</h2>
            <p>
              <strong>A.</strong> This Agreement begins on the date the LICENSEE creates an account and continues indefinitely.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION FIVE - TERMS OF PAYMENT; USERS</h2>
            <p>
              <strong>A.</strong> LICENSEE shall pay LICENSOR a license fee equal to the one the LICENSEE agreed to upon signing up for the LEARNOLOGY AI software.
            </p>
            <p>
              <strong>B.</strong> Unless otherwise stated, all prices are exclusive of state and local use, sale, and similar taxes. Any applicable taxes will be paid by LICENSEE, which taxes will appear as separate additional items on LICENSOR's invoices unless LICENSEE provides LICENSOR with a valid tax exemption certificate acceptable to the taxing authorities.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION SIX - WARRANTY</h2>
            <p>
              <strong>A.</strong> LICENSOR'S liability is limited as follows:
            </p>
            <p>
              <strong>(1)</strong> A claim must be made within thirty (30) days of the effective date, setting out the basis of the claim. For claims timely made within this period, LICENSOR, at its expense, will correct any errors in the LEARNOLOGY AI System attributable solely to LICENSOR.
            </p>
            <p>
              <strong>(2)</strong> LICENSOR GIVES NO EXPRESS WARRANTIES, GUARANTEES OR CONDITIONS. YOU MAY HAVE ADDITIONAL CONSUMER RIGHTS UNDER YOUR LOCAL LAWS WHICH THIS LICENSE AGREEMENT CANNOT CHANGE. YOU CAN'T RECOVER ANY OTHER DAMAGES, INCLUDING CONSEQUENTIAL, LOST PROFITS, SPECIAL, INDIRECT OR INCIDENTAL DAMAGES.
            </p>
            <p>
              <strong>(3)</strong> LICENSOR MAKES NO OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE. TO THE EXTENT PERMITTED UNDER YOUR LOCAL LAWS, LICENSOR EXCLUDES THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION SEVEN - LIMITATION OF LIABILITY</h2>
            <p>
              EXCEPT AS PROVIDED IN SECTION SIX, LICENSEE AGREES THE MAXIMUM LIABILITY ASSUMED BY LICENSOR UNDER THIS AGREEMENT, REGARDLESS OF THE CLAIM OR THE FORM OF ACTION OR SUIT, WHETHER IN CONTRACT, NEGLIGENCE, OR TORT, SHALL BE LIMITED TO CORRECTION OR REPLACEMENT COSTS, OR $1,000, WHICHEVER IS LESS. IN NO EVENT SHALL LICENSOR BE LIABLE FOR SPECIAL, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, EVEN IF LICENSOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. LICENSEE AGREES TO INDEMNIFY OR OTHERWISE HOLD LICENSOR HARMLESS FROM ALL CLAIMS OF THIRD PARTIES THAT MAY ARISE FROM LICENSEE'S USE OF THE LEARNOLOGY AI SOFTWARE DELIVERED UNDER THIS AGREEMENT. THE SOFTWARE IS LICENSED "AS IS." You bear the risk of using it. LICENSEE'S REMEDIES IN THIS AGREEMENT ARE EXCLUSIVE.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION EIGHT - NO SUB-LICENSE</h2>
            <p>
              In no event shall LICENSEE sub-license the LEARNOLOGY AI software to any one at any time without the prior written consent of LICENSOR.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION NINE - TECHNOLOGICAL ADVANCES</h2>
            <p>
              LICENSOR agrees that LICENSEE will have an unencumbered right to utilize improvements made in the LEARNOLOGY AI system when fully paid by LICENSEE. Charges for LICENSOR support of such improvements, if any, will be negotiated on a case-by-case basis.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION TEN - GOVERNING LAW</h2>
            <p>
              This agreement shall be construed and the legal relation between the parties determined in accordance with the laws of the State of Ohio.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION ELEVEN - WAIVER</h2>
            <p>
              The waiver, modification, or failure to insist by LICENSOR on any conditions shall not void, waive, or modify any of the other terms or conditions nor be construed as a waiver or relinquishment of LICENSOR's right to performance of any such term or terms.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION TWELVE - ASSIGNMENT</h2>
            <p>
              This agreement shall be binding on and shall inure solely to the benefit of the parties and their respective successors, and permitted assignees, and LICENSEE'S users, and not for the benefit of any other person or legal entity. LICENSEE, however, shall not assign this agreement or any rights or obligations under the agreement without first obtaining the prior written consent of LICENSOR.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION THIRTEEN - RELATIONSHIP OF PARTIES</h2>
            <p>
              Each party is independent of the other and not an agent or partner of, or joint venturer with, the other party in privity with the other for any purpose, and neither party by virtue of this Agreement shall have any right, power, or authority to act or create any obligation, expressed or implied, on behalf of the other party.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION FOURTEEN - ATTORNEY FEES</h2>
            <p>
              Should either party be required to seek the services of an attorney to enforce its rights under this Agreement, the prevailing party in such action shall be entitled to recover reasonable attorney fees, legal costs, and other collection fees and costs incurred by that party in connection with the suit.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION FIFTEEN - DELAYS</h2>
            <p>
              Neither party shall be liable or deemed in default for any delay or failure in performance of this Agreement resulting directly or indirectly from any cause completely, solely, and exclusively beyond the control of that party.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION SIXTEEN - SEVERABILITY</h2>
            <p>
              If any provision or part of this Agreement shall be declared illegal, void, or unenforceable, the remaining provisions shall continue in full force and effect.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION SEVENTEEN - LIMITATION ON ACTION</h2>
            <p>
              Any action under this Agreement, regardless of the form, whether in contract, negligence, or tort, must (a) be brought within one year after such cause of action has arisen and (b) have been preceded by written notice to the other party within fifteen (15) days after the cause of action is known, or should have been known. Venue shall be in the Trumbull County, Ohio Court of Common Pleas.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION EIGHTEEN - ENTIRE AGREEMENT AND ACKNOWLEDGMENT</h2>
            <p>
              <strong>A.</strong> The parties acknowledge that this Agreement has been read and understood, represents the entire agreement and understanding of the parties, and supersedes all prior agreements, communications, or understandings, whether oral or written.
            </p>
            <p>
              <strong>B.</strong> LICENSOR reserves the right to unilaterally amend this License Agreement as it determines at any time and from time to time, but cannot increase any burden on LICENSEE or decrease compensation and compensation rates due to LICENSEE without consent of LICENSEE.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION NINETEEN - NOTICES</h2>
            <p>
              All notices required by or related to this Agreement shall be in writing and sent to the parties at the addresses first written above by any means that will require a written acknowledgment of receipt by the receiving party.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION TWENTY - SECTION HEADINGS</h2>
            <p>
              The section headings contained in this Agreement are inserted only as a matter of convenience and reference and in no way define, limit, or describe the scope or intent of this Agreement and do not in any way affect its provisions.
            </p>

            <p>
              In witness whereof, each party has caused this Agreement to be executed by its authorized representative on the date(s) indicated, on the page next following:
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">SECTION TWENTY-ONE - MARKETING; PUBLICITY</h2>
            <p>
              <strong>A.</strong> LICENSEE is encouraged to publish its use of LEARNOLOGY AI in any media, and on any platform, it may desire. LICENSOR believes that LEARNOLOGY AI can help every student in every situation and sharing LICENSEE's experience with LEARNOLOGY AI can benefit students beyond LICENSEE's own students. LICENSEE may use LICENSOR's name, logo, image, and information on LICENSEE's landing page, social media, and all other LICENSEE publicized material whatsoever to positively promote LEARNOLOGY AI.
            </p>
            <p>
              <strong>B.</strong> LICENSEE grants LICENSOR the right, without further approval, compensation or limitation, to publish and display the following, whether extant, now known, or later developed, for use by LICENSOR in its advertising, social media, and promotion of LICENSEE and any of its products or services: LICENSEE'S name, images, photos provided by LICENSEE to LICENSOR or published by LICENSEE in any media, and logo(s), and testimonials.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4">APPENDIX A</h2>
            <p>
              <strong>Ethos:</strong> We are the AI-driven education platform for every student in every school.
            </p>
            <p>
              <strong>Mission:</strong> Empowering every learner with access to knowledge, personalized growth, and limitless potential.
            </p>
            <p>
              <strong>Product summary:</strong> LEARNOLOGY AI delivers personalized, gamified micro-lessons tailored to each school's curriculum, designed to engage students and help them thrive. Teachers also benefit with an AI-driven administrator dashboard. They get each student's real-time progress reports, learning analysis, and have access to lesson planning assistance from our AI teacher's assistant, Luna.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 