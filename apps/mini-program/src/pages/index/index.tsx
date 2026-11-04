import { Text, View } from '@tarojs/components';
import { FOUNDATION_STAGE } from '@xianglin/shared';
import './index.css';

export default function FoundationPage() {
  return (
    <View className="foundation-page">
      <Text className="foundation-title">小程序本地工程基础</Text>
      <Text className="foundation-note">{FOUNDATION_STAGE} · 开发占位页，不是产品页面</Text>
    </View>
  );
}
