import 'package:flutter_test/flutter_test.dart';
import 'package:trekindia/main.dart';

void main() {
  testWidgets('App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const TrekIndiaApp());
    expect(find.byType(TrekIndiaApp), findsOneWidget);
  });
}
