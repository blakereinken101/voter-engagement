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
    let aiContext: AICampaignContext?
}

// MARK: - AI Campaign Context

struct AICampaignContext: Codable {
    let targetUniverse: TargetUniverseConfig?
    let customSurveyQuestions: [CustomSurveyQuestion]?
    // Other fields exist in the full API response but we only need these on iOS
}

// MARK: - Target Universe Config

struct TargetUniverseConfig: Codable {
    let VH2024G: String?  // "voted" | "did-not-vote" | nil
    let VH2022G: String?
    let VH2020G: String?
    let VH2024P: String?
    let VH2022P: String?
    let VH2020P: String?

    /// Whether any criterion is actually set
    var hasAnyCriteria: Bool {
        [VH2024G, VH2022G, VH2020G, VH2024P, VH2022P, VH2020P]
            .contains { $0 != nil && !($0?.isEmpty ?? true) }
    }
}

// MARK: - Custom Survey Question (from aiContext)

struct CustomSurveyQuestion: Codable, Identifiable {
    let id: String
    let question: String
    let type: String
    let options: [String]?
}

// MARK: - Survey Question Config

struct SurveyQuestionConfig: Codable, Identifiable {
    let id: String
    let label: String   // API returns "label" not "question"
    let type: String    // "text" or "select"
    let options: [String]?

    var question: String { label }
}
