import SwiftUI

struct SurveyQuestionsView: View {
    let questions: [SurveyQuestionConfig]
    @Binding var responses: [String: String]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Survey")
                .font(.subheadline.bold())
                .foregroundStyle(.white)

            ForEach(questions) { question in
                VStack(alignment: .leading, spacing: 4) {
                    Text(question.label)
                        .font(.caption)
                        .foregroundStyle(Color.vcSlate)

                    if question.type == "select", let options = question.options, !options.isEmpty {
                        Menu {
                            Button("--") {
                                responses[question.id] = nil
                            }
                            ForEach(options, id: \.self) { option in
                                Button(option) {
                                    responses[question.id] = option
                                }
                            }
                        } label: {
                            HStack {
                                Text(responses[question.id] ?? "Select...")
                                    .font(.subheadline)
                                    .foregroundStyle(responses[question.id] != nil ? .white : Color.vcSlate)
                                Spacer()
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.caption2)
                                    .foregroundStyle(Color.vcSlate)
                            }
                            .padding(10)
                            .background(Color.vcBg)
                            .cornerRadius(8)
                        }
                    } else {
                        TextField(question.label, text: binding(for: question.id))
                            .textFieldStyle(.plain)
                            .padding(10)
                            .background(Color.vcBg)
                            .cornerRadius(8)
                            .foregroundStyle(.white)
                    }
                }
            }
        }
    }

    private func binding(for questionId: String) -> Binding<String> {
        Binding(
            get: { responses[questionId] ?? "" },
            set: { responses[questionId] = $0.isEmpty ? nil : $0 }
        )
    }
}
