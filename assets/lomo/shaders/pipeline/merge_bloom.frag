#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/post/bloom_options.glsl

uniform sampler2D u_bloom;
uniform sampler2D u_light;

layout(location = 0) out vec4 out_result;

void main() {
	vec3 light = texelFetch(u_light, ivec2(gl_FragCoord.xy), 0).rgb;

	#ifdef BLOOM_TOGGLE
	vec3 bloom = texelFetch(u_bloom, ivec2(gl_FragCoord.xy), 0).rgb;
	light = min(vec3(0.6), light) + bloom;
	#endif

	light = pow(light, vec3(1.0 / 2.2));
	out_result = vec4(light, 1.0);
}