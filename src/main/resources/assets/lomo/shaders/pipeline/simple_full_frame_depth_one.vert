#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl

/* lomo:pipeline/simple_full_frame_depth_1 */

attribute vec2 in_uv;

varying vec2 _cvv_texcoord;

void main() {
	vec4 outPos = gl_ProjectionMatrix * vec4(gl_Vertex.xy * frxu_size, 0.0, 1.0);
	gl_Position = vec4(outPos.xy, -1.0, 1.0);
	_cvv_texcoord = in_uv;
}
