#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/blend.glsl

/* lomo:pipeline/copy_to_array.frag */

uniform sampler2D u_i0;
uniform sampler2D u_i1;
uniform sampler2D u_i2;
uniform sampler2D u_i3;
uniform sampler2D u_i4;
uniform sampler2D u_i5;

uniform sampler2D u_index_to_type;

layout(location = 0) out vec4 out_colors[6];

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

	vec3 color = values[indices[5]].rgb;
	out_colors[5] = vec4(color, 1.0);

	for(int i = 4; i >= 0; --i) {
		color = blend(color, values[indices[i]]);
		out_colors[i] = vec4(color, 1.0);
	}
}