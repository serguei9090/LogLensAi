import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:loglensai/models/ingestion_job.dart";
import "package:loglensai/theme/app_theme.dart";
import "package:loglensai/widgets/molecules/processing_notification.dart";

IngestionJob _job({
  required String status,
  int processed = 0,
  int total = 100,
  String id = "1",
}) {
  return IngestionJob(
    id: int.parse(id),
    workspaceId: "ws1",
    sourceId: "src1",
    status: status,
    totalLines: total,
    processedLines: processed,
    queuePosition: 0,
    createdAt: "2026-08-15T00:00:00",
    updatedAt: "2026-08-15T00:00:00",
  );
}

Widget _host(Widget child) {
  return MaterialApp(
    theme: AppTheme.dark,
    home: Scaffold(body: SizedBox.expand(child: child)),
  );
}

void main() {
  testWidgets("renders nothing when there are no active jobs", (tester) async {
    await tester.pumpWidget(
      _host(const ProcessingNotification(jobs: [])),
    );

    expect(find.text("DRAIN3 PATTERN MINING"), findsNothing);
  });

  testWidgets("renders nothing when jobs are only completed/failed/queued", (tester) async {
    await tester.pumpWidget(
      _host(
        ProcessingNotification(
          jobs: [
            _job(status: "completed"),
            _job(status: "failed", id: "2"),
            _job(status: "queued", id: "3"),
          ],
        ),
      ),
    );

    expect(find.text("DRAIN3 PATTERN MINING"), findsNothing);
  });

  testWidgets("renders aggregate progress for active jobs", (tester) async {
    await tester.pumpWidget(
      _host(
        ProcessingNotification(
          jobs: [
            _job(status: "processing", processed: 50, total: 100),
            _job(status: "pending", processed: 25, total: 100, id: "2"),
          ],
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text("DRAIN3 PATTERN MINING"), findsOneWidget);
    expect(find.text("2 active Drain3 tasks"), findsOneWidget);
    // (50 + 25) / (100 + 100) = 37.5% -> rounds to 38%.
    expect(find.text("38%"), findsOneWidget);
    expect(find.text("75 / 200"), findsOneWidget);
  });

  testWidgets("singular task label for exactly one active job", (tester) async {
    await tester.pumpWidget(
      _host(
        ProcessingNotification(jobs: [_job(status: "processing", processed: 1, total: 4)]),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text("1 active Drain3 task"), findsOneWidget);
  });
}
