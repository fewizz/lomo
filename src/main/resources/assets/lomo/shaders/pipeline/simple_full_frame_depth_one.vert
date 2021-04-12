#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/simple_full_frame_depth_1 */

in vec3 in_vertex;
in vec2 in_uv;

out vec2 _cvv_texcoord;

void main() {
	vec4 outPos = frxu_frameProjectionMatrix * vec4(in_vertex.xy * frxu_size, 0.0, 1.0);
	gl_Position = vec4(outPos.xy, -1.0, 1.0);
	_cvv_texcoord = in_uv;
}
