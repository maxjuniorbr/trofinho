import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';

export type AppAlertActionStyle = 'default' | 'cancel' | 'destructive';

export type AppAlertAction = {
  text: string;
  style?: AppAlertActionStyle;
  onPress?: () => void | Promise<void>;
};

type AppAlertVariant = 'danger' | 'warning' | 'info' | 'success';

export type AppAlertOptions = {
  title: string;
  message?: string;
  actions?: AppAlertAction[];
  variant?: AppAlertVariant;
  icon?: LucideIcon;
};

type AppAlertContextValue = {
  showAlert: (options: AppAlertOptions) => void;
  hideAlert: () => void;
};

const AppAlertContext = createContext<AppAlertContextValue | null>(null);

export function AppAlertProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [alert, setAlert] = useState<AppAlertOptions | null>(null);

  const showAlert = useCallback((options: AppAlertOptions) => {
    setAlert(options);
  }, []);

  const hideAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const value = useMemo(() => ({ showAlert, hideAlert }), [hideAlert, showAlert]);

  return (
    <AppAlertContext.Provider value={value}>
      {children}
      <AppAlertSheet alert={alert} onClose={hideAlert} />
    </AppAlertContext.Provider>
  );
}

export function useAppAlert(): AppAlertContextValue {
  const value = useContext(AppAlertContext);
  if (!value) throw new Error('useAppAlert must be used within AppAlertProvider');
  return value;
}

function AppAlertSheet({
  alert,
  onClose,
}: Readonly<{
  alert: AppAlertOptions | null;
  onClose: () => void;
}>) {
  const { colors } = useTheme();
  const visible = alert !== null;
  const title = alert?.title ?? '';
  const actions = useMemo(() => orderActions(alert?.actions), [alert?.actions]);
  const variant = alert?.variant ?? inferVariant(actions);
  const Icon = alert?.icon ?? iconForVariant(variant);
  const iconColor = colorForVariant(variant, colors);

  const handleActionPress = useCallback(
    (action: AppAlertAction) => {
      onClose();
      action.onPress?.();
    },
    [onClose],
  );

  return (
    <BottomSheetModal visible={visible} onClose={onClose} closeLabel={`Fechar ${title}`}>
      <View style={styles.body}>
        <View style={[styles.iconBox, { backgroundColor: withAlpha(iconColor, 0.12) }]}>
          <Icon size={24} color={iconColor} strokeWidth={2.2} />
        </View>

        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>

        {alert?.message ? (
          <Text style={[styles.message, { color: colors.text.secondary }]}>{alert.message}</Text>
        ) : null}

        <View style={styles.actions}>
          {actions.map((action) => (
            <Button
              key={`${action.style ?? 'default'}:${action.text}`}
              label={action.text}
              variant={buttonVariantForAction(action)}
              size="lg"
              onPress={() => handleActionPress(action)}
              accessibilityLabel={action.text}
            />
          ))}
        </View>
      </View>
    </BottomSheetModal>
  );
}

function orderActions(actions: AppAlertAction[] | undefined): AppAlertAction[] {
  const normalized = actions && actions.length > 0 ? actions : [{ text: 'OK' }];
  const cancel = normalized.filter((action) => action.style === 'cancel');
  const primary = normalized.filter((action) => action.style !== 'cancel');
  return [...primary, ...cancel];
}

function inferVariant(actions: AppAlertAction[]): AppAlertVariant {
  if (actions.some((action) => action.style === 'destructive')) return 'danger';
  return 'info';
}

function iconForVariant(variant: AppAlertVariant): LucideIcon {
  switch (variant) {
    case 'danger':
    case 'warning':
      return TriangleAlert;
    case 'success':
      return CircleCheck;
    case 'info':
      return Info;
  }
}

function colorForVariant(
  variant: AppAlertVariant,
  colors: ReturnType<typeof useTheme>['colors'],
): string {
  switch (variant) {
    case 'danger':
      return colors.semantic.error;
    case 'warning':
      return colors.semantic.warning;
    case 'success':
      return colors.semantic.success;
    case 'info':
      return colors.accent.admin;
  }
}

function buttonVariantForAction(action: AppAlertAction): 'primary' | 'secondary' | 'danger' {
  if (action.style === 'cancel') return 'secondary';
  if (action.style === 'destructive') return 'danger';
  return 'primary';
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    gap: spacing['3'],
    paddingBottom: spacing['2'],
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['1'],
  },
  title: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.lg,
    lineHeight: typography.lineHeight.lg,
    textAlign: 'center',
  },
  message: {
    fontFamily: typography.family.medium,
    fontSize: typography.size.sm,
    lineHeight: typography.lineHeight.sm,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    gap: spacing['4'],
    marginTop: spacing['2'],
  },
});
