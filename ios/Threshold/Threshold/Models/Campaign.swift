import Foundation

// MARK: - Campaign Config

struct CampaignConfig: Codable {
    let id: String
    let name: String
    let candidateName: String?
    let state: String?
    let electionDate: String?
    let organizationName: String?
    let privacyText: String?
    let surveyQuestions: [SurveyQuestionConfig]?
}

// MARK: - Survey Question Config

struct SurveyQuestionConfig: Codable, Identifiable {
    let id: String
    let label: String   // API returns "label" not "question"
    let type: String    // "text" or "select"
    let options: [String]?

    var question: String { label }
}
