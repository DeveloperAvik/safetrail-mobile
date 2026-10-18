import * as React from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/lib/utils';

export function Screen({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  className,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}) {
  const body = <View className={cn('gap-4 p-4 pb-10', className)}>{children}</View>;
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} className="flex-1 bg-background">
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}
