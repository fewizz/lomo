#include frex:shaders/api/fragment.glsl
#include frex:shaders/lib/math.glsl

void frx_startFragment(inout frx_FragmentData fragData) {
    fragData.spriteColor = fragData.spriteColor*0.25 + vec4(0, 1, 1, 0)*0.75;
    fragData.spriteColor.a = 0.4;
}