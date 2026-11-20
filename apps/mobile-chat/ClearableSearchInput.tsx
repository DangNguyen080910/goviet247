import React, { forwardRef, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

type Props = TextInputProps & { onClear?: () => void };

// Shared by mobile search screens. Clearing follows the screen's existing change
// handler so its filters, debounce and pagination keep their normal behavior.
const ClearableSearchInput = forwardRef<TextInput, Props>(function ClearableSearchInput(
  { value, onChangeText, onClear, style, editable = true, ...props }, forwardedRef,
) {
  const fieldRef = useRef<TextInput | null>(null);
  const hasValue = String(value ?? '').length > 0;
  const disabled = !editable || props.readOnly === true;
  const flattened = StyleSheet.flatten(style) || {};
  const {
    margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical,
    marginStart, marginEnd, width, minWidth, maxWidth, alignSelf, flex, flexBasis, flexGrow, flexShrink,
    ...inputStyle
  } = flattened;
  const layout = {
    margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical,
    marginStart, marginEnd, width, minWidth, maxWidth, alignSelf, flex, flexBasis, flexGrow, flexShrink,
  };
  const rightPadding = Math.max(44, (Number(inputStyle.paddingRight ?? inputStyle.paddingHorizontal ?? inputStyle.padding ?? 0) || 0) + 36);

  function clear() {
    if (disabled) return;
    if (onClear) onClear();
    else onChangeText?.('');
    fieldRef.current?.focus();
  }

  return <View style={[layout, styles.container]}>
    <TextInput {...props} value={value} onChangeText={onChangeText} editable={editable}
      clearButtonMode="never"
      ref={node => {
        fieldRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      style={[inputStyle, hasValue && { paddingRight: rightPadding }]}
    />
    {hasValue && <Pressable accessibilityRole="button" accessibilityLabel="Xoá nội dung tìm kiếm"
      accessibilityState={{ disabled }} disabled={disabled} hitSlop={4}
      onPress={clear} style={({ pressed }) => [styles.clear, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Text style={styles.cross}>×</Text>
    </Pressable>}
  </View>;
});

const styles = StyleSheet.create({
  container: { position: 'relative' },
  clear: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 44, alignItems: 'center', justifyContent: 'center' },
  cross: { fontSize: 25, lineHeight: 28, color: '#64748b' },
});

export default ClearableSearchInput;
