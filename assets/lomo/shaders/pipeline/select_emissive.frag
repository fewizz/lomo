#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include canvas:shaders/pipeline/post/bloom_options.glsl

uniform sampler2D u_light;

layout(location = 0) out vec3 out_selected;

void main() {
	vec3 bloom = texelFetch(u_light, ivec2(gl_FragCoord.xy), 0).rgb;
	bloom = max(bloom, vec3(0.0));
	bloom *= pow(BLOOM_INTENSITY, 0.5) * frx_cameraInWater == 1 ? 10.0 : 0.05;
	bloom = clamp(bloom, vec3(0.0), vec3(2.0));
	out_selected = bloom;
}