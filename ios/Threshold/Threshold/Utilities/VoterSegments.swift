import Foundation

/// Port of src/lib/voter-segments.ts
enum VoterSegmentCalculator {
    /// Calculate vote score from 0-100 based on voting history.
    static func calculateVoteScore(voter: SafeVoterRecord) -> Double {
        var score: Double = 0
        let maxScore: Double = 100

        // General elections weighted more heavily
        let generalWeight: Double = 20
        let primaryWeight: Double = 10

        // 2024 General
        if voter.vh2024G == "Y" { score += generalWeight }
        // 2022 General
        if voter.vh2022G == "Y" { score += generalWeight }
        // 2020 General
        if voter.vh2020G == "Y" { score += generalWeight }
        // 2024 Primary
        if voter.vh2024P == "Y" { score += primaryWeight }
        // 2022 Primary
        if voter.vh2022P == "Y" { score += primaryWeight }
        // 2020 Primary
        if voter.vh2020P == "Y" { score += primaryWeight }

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
}
