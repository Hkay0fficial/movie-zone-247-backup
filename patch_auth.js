const fs = require('fs');
const file = '/Users/hkfiles/Desktop/hk app/movieApp/components/AuthScreen.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldHeader = `function FlippingLogoHeader({ flipCount }: { flipCount: number }) {
  const rotation = useSharedValue(0);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    // Determine target rotation based on flipCount
    // If flipCount is 0, we want it to end at 360 (logo side)
    // If flipCount is 1, we want it to end at 540 (text side)
    const targetAngle = 360 + flipCount * 180;
    
    // For the initial load (flipCount 0), do a full 360 coin spin entrance.
    // For subsequent flips (blurring inputs), start from the previous side (-180 degrees)
    // so it perfectly lands and locks onto the new side.
    if (flipCount === 0) {
      rotation.value = targetAngle - 360; 
    } else {
      rotation.value = targetAngle - 180;
    }

    rotation.value = withSequence(
      withTiming(targetAngle, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );

    // Glow pulse after flip
    glowAnim.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
  }, [flipCount]);`;

const targetAngleCode = `function FlippingLogoHeader({ flipCount }: { flipCount: number }) {
  const targetAngle = 360 + flipCount * 180;
  const startAngle = flipCount === 0 ? 0 : targetAngle - 180;
  
  const rotation = useSharedValue(startAngle);
  const glowAnim = useSharedValue(0);

  useEffect(() => {
    // Only perform the animation to the target angle. Since useSharedValue initialized to startAngle,
    // there will be no 1-frame flashback (bip) when the component remounts after keyboard dismissal!
    rotation.value = withSequence(
      withTiming(targetAngle, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );

    // Glow pulse after flip
    glowAnim.value = withDelay(
      700,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      )
    );
  }, [flipCount]);`;

code = code.replace(oldHeader, targetAngleCode);
fs.writeFileSync(file, code);
console.log("Patched!");
