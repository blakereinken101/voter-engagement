import SwiftUI

// MARK: - Cosmic Background

struct CosmicBackground: View {
    var body: some View {
        ZStack {
            Color.vcBg.ignoresSafeArea()

            // Purple glow – top left
            RadialGradient(
                colors: [Color.vcPurple.opacity(0.12), .clear],
                center: UnitPoint(x: 0.2, y: 0.4),
                startRadius: 0,
                endRadius: 300
            )
            .ignoresSafeArea()

            // Teal glow – top right
            RadialGradient(
                colors: [Color.vcTeal.opacity(0.08), .clear],
                center: UnitPoint(x: 0.8, y: 0.2),
                startRadius: 0,
                endRadius: 250
            )
            .ignoresSafeArea()

            // Nebula – subtle purple/pink haze
            RadialGradient(
                colors: [Color.vcPurple.opacity(0.06), Color.vcCoral.opacity(0.03), .clear],
                center: UnitPoint(x: 0.5, y: 0.5),
                startRadius: 50,
                endRadius: 400
            )
            .ignoresSafeArea()

            // Purple glow – bottom center
            RadialGradient(
                colors: [Color.vcPurpleLight.opacity(0.06), .clear],
                center: UnitPoint(x: 0.6, y: 0.8),
                startRadius: 0,
                endRadius: 300
            )
            .ignoresSafeArea()

            // Gold glow – bottom left
            RadialGradient(
                colors: [Color.vcGold.opacity(0.04), .clear],
                center: UnitPoint(x: 0.1, y: 0.9),
                startRadius: 0,
                endRadius: 250
            )
            .ignoresSafeArea()

            // Deep space dust band – diagonal
            LinearGradient(
                colors: [.clear, Color.vcPurple.opacity(0.03), Color.vcTeal.opacity(0.02), .clear],
                startPoint: UnitPoint(x: 0.0, y: 0.3),
                endPoint: UnitPoint(x: 1.0, y: 0.7)
            )
            .ignoresSafeArea()

            // Starfield
            StarfieldView()
                .ignoresSafeArea()

            // Twinkling stars overlay
            TwinklingStarsView()
                .ignoresSafeArea()
        }
    }
}

// MARK: - Starfield (static stars via Canvas)

struct StarfieldView: View {
    // Dense star field – many small white dots
    private let stars: [(x: CGFloat, y: CGFloat, size: CGFloat, opacity: Double)] = {
        var result: [(CGFloat, CGFloat, CGFloat, Double)] = []
        // Dim background stars
        let positions: [(CGFloat, CGFloat)] = [
            (0.03, 0.12), (0.08, 0.28), (0.10, 0.15), (0.12, 0.92),
            (0.15, 0.70), (0.18, 0.42), (0.20, 0.05), (0.22, 0.52),
            (0.25, 0.35), (0.28, 0.88), (0.30, 0.05), (0.33, 0.62),
            (0.35, 0.85), (0.38, 0.18), (0.40, 0.10), (0.42, 0.73),
            (0.45, 0.78), (0.48, 0.30), (0.50, 0.60), (0.52, 0.95),
            (0.55, 0.45), (0.57, 0.15), (0.60, 0.30), (0.62, 0.82),
            (0.65, 0.75), (0.67, 0.08), (0.70, 0.25), (0.72, 0.55),
            (0.75, 0.42), (0.78, 0.08), (0.80, 0.90), (0.82, 0.35),
            (0.85, 0.55), (0.87, 0.72), (0.90, 0.10), (0.92, 0.48),
            (0.95, 0.40), (0.97, 0.85), (0.05, 0.50), (0.14, 0.33),
            (0.26, 0.67), (0.36, 0.48), (0.44, 0.22), (0.54, 0.68),
            (0.64, 0.52), (0.74, 0.88), (0.84, 0.18), (0.94, 0.62),
        ]
        for (i, pos) in positions.enumerated() {
            let size: CGFloat = i % 5 == 0 ? 1.5 : 1.0
            let opacity = Double.random(in: 0.15...0.45)
            result.append((pos.0, pos.1, size, opacity))
        }
        return result
    }()

    // Colored accent stars
    private let accentStars: [(x: CGFloat, y: CGFloat, size: CGFloat, color: Color)] = [
        (0.75, 0.65, 2.0, Color.vcPurple.opacity(0.6)),
        (0.20, 0.80, 2.0, Color.vcTeal.opacity(0.5)),
        (0.50, 0.20, 1.5, Color.vcPurpleLight.opacity(0.4)),
        (0.88, 0.38, 1.5, Color.vcGold.opacity(0.4)),
        (0.12, 0.15, 2.0, Color.vcTeal.opacity(0.35)),
        (0.42, 0.90, 1.5, Color.vcPurple.opacity(0.45)),
    ]

    var body: some View {
        Canvas { context, size in
            // Draw dim stars
            for star in stars {
                let point = CGPoint(x: star.x * size.width, y: star.y * size.height)
                let rect = CGRect(
                    x: point.x - star.size / 2,
                    y: point.y - star.size / 2,
                    width: star.size,
                    height: star.size
                )
                context.opacity = star.opacity
                context.fill(Circle().path(in: rect), with: .color(.white))
            }

            // Draw accent stars with glow
            for star in accentStars {
                let point = CGPoint(x: star.x * size.width, y: star.y * size.height)
                // Glow
                let glowRect = CGRect(x: point.x - 3, y: point.y - 3, width: 6, height: 6)
                context.opacity = 0.3
                context.fill(Circle().path(in: glowRect), with: .color(star.color))
                // Core
                let coreRect = CGRect(x: point.x - star.size / 2, y: point.y - star.size / 2, width: star.size, height: star.size)
                context.opacity = 1.0
                context.fill(Circle().path(in: coreRect), with: .color(star.color))
            }
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Twinkling Stars (animated)

struct TwinklingStarsView: View {
    @State private var twinkle = false

    private let twinklingStars: [(x: CGFloat, y: CGFloat, delay: Double)] = [
        (0.15, 0.22, 0.0),
        (0.42, 0.08, 0.3),
        (0.68, 0.35, 0.7),
        (0.88, 0.58, 1.1),
        (0.32, 0.72, 1.5),
        (0.78, 0.12, 1.9),
        (0.08, 0.88, 2.3),
        (0.55, 0.52, 0.5),
        (0.92, 0.82, 1.3),
        (0.25, 0.45, 1.7),
    ]

    var body: some View {
        GeometryReader { geo in
            ForEach(Array(twinklingStars.enumerated()), id: \.offset) { index, star in
                Circle()
                    .fill(.white)
                    .frame(width: 2, height: 2)
                    .opacity(twinkle ? 0.6 : 0.1)
                    .animation(
                        .easeInOut(duration: Double.random(in: 1.5...2.5))
                        .repeatForever(autoreverses: true)
                        .delay(star.delay),
                        value: twinkle
                    )
                    .position(
                        x: star.x * geo.size.width,
                        y: star.y * geo.size.height
                    )
            }
        }
        .allowsHitTesting(false)
        .onAppear { twinkle = true }
    }
}

// MARK: - Shooting Star (for launch/sign-in)

struct ShootingStarView: View {
    @State private var phase: CGFloat = 0
    @State private var opacity: Double = 0

    var body: some View {
        GeometryReader { geo in
            let startX: CGFloat = geo.size.width * 0.90
            let startY: CGFloat = geo.size.height * 0.05
            let endX: CGFloat = geo.size.width * 0.10
            let endY: CGFloat = geo.size.height * 0.40

            let currentX = startX + (endX - startX) * phase
            let currentY = startY + (endY - startY) * phase

            // Angle of travel for rotation
            let angle = atan2(endY - startY, endX - startX) * 180 / .pi

            ZStack {
                // Long luminous trail
                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                .white.opacity(0.8),
                                Color.vcPurpleLight.opacity(0.5),
                                Color.vcTeal.opacity(0.2),
                                .clear,
                            ],
                            startPoint: .trailing,
                            endPoint: .leading
                        )
                    )
                    .frame(width: 120, height: 2)
                    .rotationEffect(.degrees(angle))
                    .position(x: currentX, y: currentY)
                    .opacity(opacity)

                // Bright star head with glow
                Circle()
                    .fill(.white)
                    .frame(width: 4, height: 4)
                    .shadow(color: .white.opacity(0.9), radius: 6)
                    .shadow(color: Color.vcPurpleLight.opacity(0.6), radius: 12)
                    .position(x: currentX, y: currentY)
                    .opacity(opacity)

                // Secondary sparkle particles along trail
                ForEach(0..<3, id: \.self) { i in
                    let trailPhase = max(0, phase - CGFloat(i + 1) * 0.06)
                    let tx = startX + (endX - startX) * trailPhase
                    let ty = startY + (endY - startY) * trailPhase

                    Circle()
                        .fill(.white)
                        .frame(width: CGFloat(2 - i), height: CGFloat(2 - i))
                        .opacity(opacity * (0.5 - Double(i) * 0.15))
                        .position(x: tx, y: ty)
                }
            }
        }
        .allowsHitTesting(false)
        .onAppear {
            // Fade in quickly
            withAnimation(.easeIn(duration: 0.15).delay(0.4)) {
                opacity = 1.0
            }
            // Animate the star across the sky
            withAnimation(.easeOut(duration: 1.0).delay(0.4)) {
                phase = 1.0
            }
            // Fade out at the end
            withAnimation(.easeOut(duration: 0.3).delay(1.1)) {
                opacity = 0
            }
        }
    }
}

// MARK: - Glass Card Modifier

struct GlassCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(.ultraThinMaterial.opacity(0.4))
            .background(Color.white.opacity(0.07))
            .cornerRadius(16)
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.white.opacity(0.12), lineWidth: 1)
            )
    }
}

extension View {
    func glassCard() -> some View {
        modifier(GlassCard())
    }
}

// MARK: - Glass Input Modifier

struct GlassInput: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(12)
            .background(Color.white.opacity(0.08))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(Color.white.opacity(0.1), lineWidth: 1)
            )
            .foregroundStyle(.white)
    }
}

extension View {
    func glassInput() -> some View {
        modifier(GlassInput())
    }
}

// MARK: - Text Gradient

struct GradientText: View {
    let text: String
    let font: Font

    init(_ text: String, font: Font = .title2.bold()) {
        self.text = text
        self.font = font
    }

    var body: some View {
        Text(text)
            .font(font)
            .foregroundStyle(
                LinearGradient(
                    colors: [Color.vcPurple, Color.vcPurpleLight, Color.vcTeal],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
    }
}
