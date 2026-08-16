import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:loglensai/models/cluster.dart";
import "package:loglensai/widgets/molecules/cluster_row.dart";

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

const _cluster = Cluster(id: "c1", template: "User <*> logged in", size: 42);

void main() {
  testWidgets("renders template, index, and hit count without throwing", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const ClusterRow(index: 0, cluster: _cluster, total: 100, type: ClusterRowType.noise),
      ),
    );

    expect(find.text("#1"), findsOneWidget);
    expect(find.text("User <*> logged in"), findsOneWidget);
    expect(find.text("42 hits"), findsOneWidget);
  });

  testWidgets("tapping expands the row and awaits fetchSamples", (tester) async {
    await tester.pumpWidget(
      _wrap(
        ClusterRow(
          index: 2,
          cluster: _cluster,
          total: 100,
          type: ClusterRowType.error,
          fetchSamples: () async => ["line one", "line two"],
        ),
      ),
    );

    expect(find.text("EXAMPLE LOGS (UP TO 10)"), findsNothing);

    await tester.tap(find.text("User <*> logged in"));
    await tester.pump();
    await tester.pump();

    expect(find.text("EXAMPLE LOGS (UP TO 10)"), findsOneWidget);
    expect(find.text("line one"), findsOneWidget);
    expect(find.text("line two"), findsOneWidget);
  });

  testWidgets("tapping again collapses the row", (tester) async {
    await tester.pumpWidget(
      _wrap(
        ClusterRow(
          index: 0,
          cluster: _cluster,
          total: 100,
          type: ClusterRowType.noise,
          fetchSamples: () async => ["only line"],
        ),
      ),
    );

    await tester.tap(find.text("User <*> logged in"));
    await tester.pump();
    await tester.pump();
    expect(find.text("only line"), findsOneWidget);

    await tester.tap(find.text("User <*> logged in"));
    await tester.pump();
    expect(find.text("only line"), findsNothing);
  });

  testWidgets("with no fetchSamples, tapping is a no-op (no expand)", (tester) async {
    await tester.pumpWidget(
      _wrap(
        const ClusterRow(index: 0, cluster: _cluster, total: 100, type: ClusterRowType.noise),
      ),
    );

    await tester.tap(find.text("User <*> logged in"));
    await tester.pump();

    expect(find.text("EXAMPLE LOGS (UP TO 10)"), findsNothing);
  });
}
