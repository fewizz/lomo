#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/post/bloom_options.glsl

#include lomo:general

uniform sampler2D u_bloom;
uniform sampler2D u_light;

layout(location = 0) out vec4 out_result;

void main() {
	vec3 light = texelFetch(u_light, ivec2(gl_FragCoord.xy), 0).rgb;
	light = pow(light, vec3(2.2));

	#ifdef BLOOM_TOGGLE
	vec3 bloom = texelFetch(u_bloom, ivec2(gl_FragCoord.xy), 0).rgb;
	light *= (1.0 - pow(BLOOM_INTENSITY, 0.5) * 0.04);//min(vec3(0.6), light) + bloom;
	light += bloom;
	#endif

	#if TONEMAPPING == TONEMAPPING_EXP_1
	light = vec3(1.0) - exp(-light);
	#elif TONEMAPPING == TONEMAPPING_ACES
	light = 1.0 - exp(-light / 1.0);
	float a = 2.51f; float b = 0.03f;
	float c = 2.43f;
	float d = 0.59f;
	float e = 0.14f;
	light = ((light*(a*light+b))/(light*(c*light+d)+e));
	//#elif TONEMAPPING == TONEMAPPING_SMOOTHSTEP
	//light = pow(smoothstep(vec3(0.0), vec3(1.0), light / 10.0), vec3(0.2));
	#endif

	light = pow(light, vec3(1.0 / 2.2));
	out_result = vec4(light, 1.0);
}