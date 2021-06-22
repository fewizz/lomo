#include frex:shaders/api/header.glsl
#extension GL_ARB_explicit_attrib_location : require

// lomo:copy_2_depth

uniform sampler2D u_depth_0;
uniform sampler2D u_depth_1;

in vec2 vs_uv;

layout(location = 0) out vec4 out_depth_0;
layout(location = 1) out vec4 out_depth_1;

void main() {
	out_depth_0 = texture(u_depth_0, vs_uv);
	out_depth_1 = texture(u_depth_1, vs_uv);
}
