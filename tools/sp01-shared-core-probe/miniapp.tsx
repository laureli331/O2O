import { View, Text, Button } from '@tarojs/components'
import { useCounter } from '@o2o/sp01-shared/react'
export default function Probe() {
  const counter = useCounter()
  return <View><Text>{counter.label}</Text><Button id="probe-increment" onClick={counter.increment}>Increment</Button>
    <Button id="probe-reset" onClick={counter.reset}>Reset</Button></View>
}
