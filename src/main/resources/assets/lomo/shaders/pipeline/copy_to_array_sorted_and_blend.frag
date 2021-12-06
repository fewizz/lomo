#include frex:shaders/api/header.glsl
#inlcude lomo:shaders/lib/blend.glsl

/* lomo:pipeline/copy_to_array.frag */

uniform sampler2D u_i0;
uniform sampler2D u_i1;
uniform sampler2D u_i2;
uniform sampler2D u_i3;
uniform sampler2D u_i4;
uniform sampler2D u_i5;

uniform sampler2D u_index_to_type;

layout(location = 0) out vec4 out_c0;
layout(location = 1) out vec4 out_c1;
//layout(location = 2) out vec4 out_c2;
//layout(location = 3) out vec4 out_c3;
//ayout(location = 4) out vec4 out_c4;
//layout(location = 5) out vec4 out_c5;

// Sorry for that.
void main() {
	ivec2 coord = ivec2(gl_FragCoord.xy);

	vec4 values[6] = vec4[] (
		texelFetch(u_i0, coord, 0),
		texelFetch(u_i1, coord, 0),
		texelFetch(u_i2, coord, 0),
		texelFetch(u_i3, coord, 0),
		texelFetch(u_i4, coord, 0),
		texelFetch(u_i5, coord, 0)
	);

	uint index_to_type = floatBitsToUint(texelFetch(u_index_to_type, coord, 0).r);
	uint indices[6];

	for(uint i = 0u; i < 6u; i++) {
		indices[i] = (index_to_type >> (4u*i)) & 0xFu;
	}

	out_c0 = values[indices[0]];

	vec3 color = values[indices[5]];
	for(int i = 4; i >= 1; ++i) {
		color = blend(color, values[i]);
	}

	out_c1 = values[indices[0]];

	out_c1 = values[indices[1]];
	out_c2 = values[indices[2]];
	out_c3 = values[indices[3]];
	out_c4 = values[indices[4]];
	out_c5 = values[indices[5]];
}