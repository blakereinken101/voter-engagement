import SwiftUI

struct RolodexView: View {
    @Environment(ContactsViewModel.self) private var contacts
    @State private var currentIndex = 0
    @State private var showDetail = false

    private var sortedItems: [ActionPlanItem] {
        contacts.actionPlanState
            .filter { !$0.contacted }
            .sorted { a, b in
                let aPriority = a.matchResult.segment?.priority ?? 0
                let bPriority = b.matchResult.segment?.priority ?? 0
                return aPriority > bPriority
            }
    }

    var body: some View {
        ZStack {
            Color.vcBg.ignoresSafeArea()

            if sortedItems.isEmpty {
                VStack(spacing: 12) {
                    if contacts.personEntries.isEmpty {
                        Image(systemName: "tray")
                            .font(.system(size: 40))
                            .foregroundStyle(Color.vcSlate)
                        Text("No contacts to show")
                            .foregroundStyle(Color.vcSlate)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(Color.vcTeal)
                        Text("All caught up!")
                            .font(.headline)
                            .foregroundStyle(.white)
                        Text("You've contacted everyone")
                            .foregroundStyle(Color.vcSlate)
                    }
                }
            } else {
                VStack(spacing: 16) {
                    // Progress
                    HStack {
                        Text("\(currentIndex + 1) of \(sortedItems.count)")
                            .font(.caption)
                            .foregroundStyle(Color.vcSlate)

                        Spacer()

                        ProgressView(value: Double(currentIndex), total: Double(sortedItems.count))
                            .tint(Color.vcPurple)
                            .frame(width: 100)
                    }
                    .padding(.horizontal)

                    // Card
                    if currentIndex < sortedItems.count {
                        RolodexCardView(
                            item: sortedItems[currentIndex],
                            onNext: advanceCard,
                            onSkip: advanceCard
                        )
                        .id(sortedItems[currentIndex].id)
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                    }
                }
                .padding(.top, 8)
            }
        }
    }

    private func advanceCard() {
        withAnimation(.spring(response: 0.3)) {
            if currentIndex < sortedItems.count - 1 {
                currentIndex += 1
            } else {
                currentIndex = 0
            }
        }
    }
}
