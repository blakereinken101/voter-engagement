import UIKit

enum SMSTemplates {
    static func getTemplate(segment: VoterSegment?, electionDate: String?) -> String {
        let dateStr = electionDate ?? "Election Day"
        switch segment {
        case .rarelyVoter:
            return "Hey {name}! It's {volunteer}. Quick question - are you planning to vote this November? I can help with any info you need. Let me know!"
        case .sometimesVoter:
            return "Hi {name}, it's {volunteer}! Just checking in about the upcoming election on \(dateStr). Have you thought about your plan to vote? Would love to chat!"
        case .superVoter:
            return "Hey {name}! {volunteer} here. Thanks for being such a consistent voter! I'm helping get more people engaged this election - know anyone who might need a nudge?"
        case nil:
            return "Hi {name}! It's {volunteer}. I'm reaching out to friends and neighbors about the upcoming election. Are you registered to vote? Happy to help if you need info!"
        }
    }

    static func fillTemplate(_ template: String, contactName: String, volunteerName: String) -> String {
        template
            .replacingOccurrences(of: "{name}", with: contactName)
            .replacingOccurrences(of: "{volunteer}", with: volunteerName)
    }

    static func generateSMSURL(phone: String, message: String) -> URL? {
        let cleaned = phone.replacingOccurrences(of: "[^0-9+]", with: "", options: .regularExpression)
        guard let encoded = message.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else { return nil }
        return URL(string: "sms:\(cleaned)?&body=\(encoded)")
    }

    static func openSMS(
        phone: String,
        contactFirstName: String,
        volunteerName: String,
        segment: VoterSegment?,
        electionDate: String?
    ) {
        let template = getTemplate(segment: segment, electionDate: electionDate)
        let message = fillTemplate(template, contactName: contactFirstName, volunteerName: volunteerName)
        guard let url = generateSMSURL(phone: phone, message: message) else { return }
        UIApplication.shared.open(url)
    }
}
