#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/post/bloom_options.glsl

uniform sampler2D u_light;

layout(location = 0) out vec3 out_selected;

void main() {
	out_selected = max(
		vec3(0.0),
		texelFetch(u_light, ivec2(gl_FragCoord.xy), 0).rgb - vec3(BLOOM_CUTOFF * 200.0)
	);
}