import SwiftUI
import os

private let pickerLog = Logger(subsystem: "com.thresholdvote.app", category: "CampaignPicker")

struct CampaignPickerView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let _ = pickerLog.notice("body evaluated — memberships count: \(self.auth.memberships.count)")

        NavigationStack {
            List {
                ForEach(auth.memberships, id: \.campaignId) { membership in
                    let isActive = membership.campaignId == auth.activeMembership?.campaignId

                    Button {
                        pickerLog.notice("Button tapped: \(membership.campaignName ?? membership.campaignId, privacy: .public) (\(membership.campaignId, privacy: .public)), isActive: \(isActive)")
                        if !isActive {
                            auth.performCampaignSwitch(to: membership.campaignId)
                        }
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(membership.campaignName ?? membership.campaignId)
                                    .font(.subheadline.weight(.medium))

                                Text(membership.role.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()

                            if isActive {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(Color.vcTeal)
                            }
                        }
                    }
                    .listRowBackground(Color.vcBgCard)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.vcBg)
            .navigationTitle("Campaigns")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(Color.vcPurpleLight)
                }
            }
        }
        .presentationDetents([.medium])
        .onAppear {
            pickerLog.notice("onAppear — memberships count: \(self.auth.memberships.count)")
            for m in auth.memberships {
                pickerLog.notice("  membership: \(m.campaignName ?? "?", privacy: .public) (\(m.campaignId, privacy: .public))")
            }
            pickerLog.notice("active campaignId: \(self.auth.activeMembership?.campaignId ?? "nil", privacy: .public)")
        }
    }
}
