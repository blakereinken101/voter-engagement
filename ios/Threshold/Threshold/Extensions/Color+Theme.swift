import SwiftUI

extension Color {
    // MARK: - Primary
    static let vcPurple = Color(hex: "#6C3CE1")
    static let vcPurpleLight = Color(hex: "#8B5CF6")
    static let vcPurpleDark = Color(hex: "#2D0A4E")

    // MARK: - Accent
    static let vcTeal = Color(hex: "#14B8A6")
    static let vcCoral = Color(hex: "#F87171")
    static let vcGold = Color(hex: "#F59E0B")
    static let vcAmber = Color(hex: "#D97706")

    // MARK: - Neutral
    static let vcSlate = Color(hex: "#64748B")
    static let vcGray = Color(hex: "#374151")
    static let vcBg = Color(hex: "#0A0118")
    static let vcBgCard = Color(hex: "#1A0B2E")

    // MARK: - Semantic
    static let vcSuccess = vcTeal
    static let vcWarning = vcGold
    static let vcDanger = vcCoral

    // MARK: - Party Colors
    static let partyDem = Color.blue
    static let partyRep = Color.red
    static let partyInd = Color.purple
    static let partyLib = Color.orange
    static let partyGrn = Color.green

    static func partyColor(for affiliation: String) -> Color {
        switch affiliation {
        case "DEM": return .partyDem
        case "REP": return .partyRep
        case "IND": return .partyInd
        case "LIB": return .partyLib
        case "GRN": return .partyGrn
        default: return .vcSlate
        }
    }
}

// MARK: - Hex Color Init

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
