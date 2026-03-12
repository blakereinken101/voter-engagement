import Foundation

/// Port of src/lib/voter-segments.ts
enum VoterSegmentCalculator {
    /// Vote codes that count as "voted" — In Person, Absentee, and Early
    private static let votedCodes: Set<String> = ["Y", "A", "E"]

    /// Calculate vote score from 0-100 based on voting history.
    static func calculateVoteScore(voter: SafeVoterRecord) -> Double {
        var score: Double = 0
        let maxScore: Double = 100

        // General elections weighted more heavily
        let generalWeight: Double = 20
        let primaryWeight: Double = 10

        // 2024 General
        if votedCodes.contains(voter.vh2024G) { score += generalWeight }
        // 2022 General
        if votedCodes.contains(voter.vh2022G) { score += generalWeight }
        // 2020 General
        if votedCodes.contains(voter.vh2020G) { score += generalWeight }
        // 2024 Primary
        if votedCodes.contains(voter.vh2024P) { score += primaryWeight }
        // 2022 Primary
        if votedCodes.contains(voter.vh2022P) { score += primaryWeight }
        // 2020 Primary
        if votedCodes.contains(voter.vh2020P) { score += primaryWeight }

        return min(score, maxScore)
    }

    /// Determine voter segment from vote score.
    static func determineSegment(voteScore: Double) -> VoterSegment {
        if voteScore >= 60 {
            return .superVoter
        } else if voteScore >= 30 {
            return .sometimesVoter
        } else {
            return .rarelyVoter
        }
    }

    /// Check if a voter matches the campaign's target universe criteria.
    /// Returns true only if ALL specified criteria match (AND logic).
    static func isInTargetUniverse(voter: SafeVoterRecord, config: TargetUniverseConfig?) -> Bool {
        guard let config else { return false }

        let elections: [(value: String, criterion: String?)] = [
            (voter.vh2024G, config.VH2024G),
            (voter.vh2022G, config.VH2022G),
            (voter.vh2020G, config.VH2020G),
            (voter.vh2024P, config.VH2024P),
            (voter.vh2022P, config.VH2022P),
            (voter.vh2020P, config.VH2020P),
        ]

        var hasCriteria = false
        for (voteValue, criterion) in elections {
            guard let criterion, !criterion.isEmpty else { continue }
            hasCriteria = true

            let voted = votedCodes.contains(voteValue)
            if criterion == "voted" && !voted { return false }
            if criterion == "did-not-vote" && voted { return false }
        }

        return hasCriteria
    }
}
