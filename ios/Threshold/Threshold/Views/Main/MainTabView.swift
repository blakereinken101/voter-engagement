import SwiftUI

struct MainTabView: View {
    @Environment(ContactsViewModel.self) private var contacts
    @State private var selectedTab = 0

    @State private var showScanSheet = false

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView(selectedTab: $selectedTab)
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }
                .tag(0)

            PeopleView()
                .tabItem {
                    Label("People", systemImage: "person.2.fill")
                }
                .tag(1)

            // Camera tab — opens scan sheet instead of navigating
            Color.clear
                .tabItem {
                    Label("Scan", systemImage: "camera.fill")
                }
                .tag(3)

            CoachView(selectedTab: $selectedTab)
                .tabItem {
                    Label("Coach", systemImage: "sparkles")
                }
                .tag(2)
        }
        .tint(Color.vcPurple)
        .onChange(of: selectedTab) { oldValue, newValue in
            if newValue == 3 {
                // Don't actually navigate to the scan tab — present the sheet
                selectedTab = oldValue
                showScanSheet = true
            } else if newValue == 1 {
                // Reload contacts when switching to People tab for freshness after imports
                Task { await contacts.loadContacts() }
            }
        }
        .fullScreenCover(isPresented: $showScanSheet) {
            ScanSheetView()
        }
        .task {
            await contacts.loadContacts()
        }
    }
}

// MARK: - People View (Tab 2)

struct PeopleView: View {
    @Environment(ContactsViewModel.self) private var contacts
    @Environment(AuthViewModel.self) private var auth
    @State private var viewMode: PeopleViewMode = .list
    @State private var showWizard = false

    enum PeopleViewMode: String, CaseIterable {
        case list = "List"
        case rolodex = "Rolodex"
        case map = "Map"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                CosmicBackground()

                VStack(spacing: 0) {
                    // Segmented control
                    Picker("View", selection: $viewMode) {
                        ForEach(PeopleViewMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)
                    .padding(.top, 8)

                    switch viewMode {
                    case .list:
                        ContactListView()
                    case .rolodex:
                        RolodexView()
                    case .map:
                        NearbyView()
                    }
                }
            }
            .navigationTitle("People")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                if contacts.hasUnmatchedContacts {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            Task {
                                await contacts.runMatching(state: auth.campaignConfig?.state ?? "")
                            }
                        } label: {
                            if contacts.isLoading {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(Color.vcTeal)
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .foregroundStyle(Color.vcTeal)
                            }
                        }
                        .disabled(contacts.isLoading)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showWizard = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .foregroundStyle(Color.vcPurple)
                    }
                }
            }
            .fullScreenCover(isPresented: $showWizard) {
                WizardView(isPresented: $showWizard)
            }
        }
    }
}

// MARK: - Coach View (Tab 3)

struct CoachView: View {
    @Binding var selectedTab: Int

    var body: some View {
        NavigationStack {
            ChatView()
                .navigationTitle("AI Coach")
                .navigationBarTitleDisplayMode(.inline)
                .toolbarBackground(Color.vcBg, for: .navigationBar)
                .toolbarBackground(.visible, for: .navigationBar)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            selectedTab = 0
                        } label: {
                            Image(systemName: "house.fill")
                                .foregroundStyle(Color.vcPurpleLight)
                        }
                    }
                }
        }
    }
}
