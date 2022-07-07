#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/post/bloom_options.glsl

uniform sampler2D u_bloom;
uniform sampler2D u_light;

layout(location = 0) out vec4 out_result;

void main() {
	vec3 bloom = texelFetch(u_bloom, ivec2(gl_FragCoord.xy), 0).rgb;
	vec3 light = texelFetch(u_light, ivec2(gl_FragCoord.xy), 0).rgb;
	vec3 result = min(vec3(1.0), light) + bloom;
	result = pow(result, vec3(1.0 / 2.2));
	out_result = vec4(result, 1.0);
}