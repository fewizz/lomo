#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/translucent.frag */

uniform sampler2D u_translucent;
uniform sampler2D u_translucent_depth;
uniform sampler2D u_solid;
uniform sampler2D u_solid_depth;

varying vec2 _cvv_texcoord;

vec3 blend(vec4 dst, vec4 src) {
	return (dst.rgb * (1.0 - src.a)) + src.rgb;
}

void main() {
	vec4 color = vec4(0);
	vec4 translucent_color = texture2D(u_translucent, _cvv_texcoord);
	vec4 solid_color = texture2D(u_solid, _cvv_texcoord);

	float translucent_depth = vec4(texture2D(u_translucent_depth, _cvv_texcoord)).r;
	float solid_depth = vec4(texture2D(u_solid_depth, _cvv_texcoord)).r;

	if(translucent_color == vec4(0)) {
		color = solid_color;
	}
	else {
		vec2 win_xy = gl_FragCoord.xy;

		mat4 proj = frx_projectionMatrix();

		vec3 translucent_v = window_to_world(vec3(win_xy, translucent_depth), proj);
		vec3 solid_v = window_to_world(vec3(win_xy, solid_depth), proj);

		color = translucent_color;

		translucent_v /= 10;
		float translucent_length_sq = dot(translucent_v, translucent_v);

		float result = 0;

		if(solid_depth != 1) {
			solid_v /= 10;
			float solid_length_sq = dot(solid_v, solid_v);

			result = solid_length_sq - translucent_length_sq;
		}
		else {
			result = translucent_length_sq;
		}
		color.a = clamp(result, 0, 1);
		color = vec4(blend(solid_color, color), 1);
	}

	gl_FragData[0] = color;
	gl_FragDepth = translucent_depth;
}