import React, { forwardRef, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { moneySuggestions, suggestedMoneyLabel } from '../../packages/shared/moneySuggestions.js';

const MoneyInput = forwardRef<TextInput, TextInputProps>(function MoneyInput(
  { value, onChangeText, onFocus, onBlur, style, editable = true, ...props }, forwardedRef,
) {
  const field = useRef<TextInput | null>(null);
  const [focused, setFocused] = useState(false);
  const disabled = !editable || props.readOnly === true;
  const suggestions = focused && !disabled ? moneySuggestions(value) : [];
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
  return <View style={layout}>
    <TextInput {...props} value={value} onChangeText={onChangeText} editable={editable}
      style={inputStyle}
      onFocus={event => { setFocused(true); onFocus?.(event); }}
      onBlur={event => { setFocused(false); onBlur?.(event); }}
      ref={node => {
        field.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }} />
    {!!suggestions.length && <View style={styles.suggestions}>
      <Text style={styles.caption}>Chọn nhanh số tiền</Text>
      <View style={styles.row}>
        {suggestions.map(amount => <Pressable key={amount} accessibilityRole="button"
          accessibilityLabel={`Chọn số tiền ${amount.toLocaleString('vi-VN')} đồng`}
          onPressIn={() => field.current?.focus()}
          onPress={() => { if (!disabled) { onChangeText?.(String(amount)); field.current?.focus(); } }}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.65 }]}>
          <Text style={styles.chipText}>{suggestedMoneyLabel(amount)}</Text>
        </Pressable>)}
      </View>
    </View>}
  </View>;
});

const styles = StyleSheet.create({
  suggestions: { marginTop: 6 },
  caption: { color: '#667085', fontSize: 12, marginBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  chipText: { color: '#1d4ed8', fontWeight: '700', fontSize: 14 },
});

export default MoneyInput;
