#include frex:shaders/api/header.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/math.glsl
#include lomo:shaders/lib/sky.glsl
#include lomo:shaders/lib/blend.glsl
#include lomo:shaders/lib/ray_plane.glsl
#include lomo:shaders/lib/hash.glsl
#include lomo:shaders/lib/traverser.glsl

/* lomo:post.frag */

uniform sampler2DArray u_colors;
uniform sampler2DArray u_normals;
uniform sampler2DArray u_extras;
uniform sampler2DArray u_depths;
uniform sampler2DArray u_win_normals;
uniform sampler2DArray u_hi_depths;
uniform sampler2D u_accum_0;

layout(location = 0) out vec4 out_color;

void main() {
	const int steps = 3;
	const int max_index = steps - 1;
	vec3 lights[steps];
	vec3 colors[steps];

	fb_pos pos = fb_pos(ufp16vec2_from_vec2(gl_FragCoord.xy), 0);

	vec3 pos_cs = cam_near(gl_FragCoord.xy);

	int i = 0;

	vec3 dir_cs = cam_dir_to_z1(gl_FragCoord.xy);
	vec3 dir_ws = vec3(0.0, 0.0, 1.0);
	float sky_light = 0.0;

	for(;true; ++i) {
		fb_pos prev_pos = pos;
		vec3 prev_pos_cs = pos_cs;

		fb_traversal_result res = traverse_fb(
			pos,
			dir_ws,
			u_hi_depths,
			u_depths,
			u_win_normals,
			0u
		);
		pos = res.pos;
		uvec2 uxy = outer_as_uvec2(pos.m);

		bool success = res.code == TRAVERSAL_SUCCESS;
		bool under = res.code == TRAVERSAL_POSSIBLY_UNDER;
		bool out_of_fb = res.code == TRAVERSAL_OUT_OF_FB;

		/*if(res.code == TRAVERSAL_POSSIBLY_UNDER) {
			lights[i] = vec3(1.0, 0.0, 0.0);
			break;
		}
		else if(res.code == TRAVERSAL_OUT_OF_FB) {
			lights[i] = vec3(0.0, 1.0, 0.0);
			break;
		}
		else if(res.code == TRAVERSAL_TOO_LONG) {
			lights[i] = vec3(1.0, 0.0, 1.0);
			break;
		}*/

		pos_cs = win_to_cam(vec3(ufp16vec2_as_vec2(pos.m), pos.z));

		
		if(out_of_fb && pos.z >= 1.0) {
			sky_light = 1.0;
		}

		vec4 extras;
		vec3 light;

		if(success) {
			float dist = distance(prev_pos_cs, pos_cs) / 1000000.;
			extras = texelFetch(u_extras, ivec3(uxy, 0), 0);
			sky_light = extras.y;
			light = fog_color(mat3(frx_inverseViewMatrix) * dir_cs, dist);
		}
		else {
			light = sky_color(mat3(frx_inverseViewMatrix) * dir_cs);
		}
		light *= sky_light * sky_light;

		if(!success) {
			lights[i] = light;
			break;
		}

		vec3 color = pow3(texelFetch(u_colors, ivec3(uxy, 0), 0).rgb, 2.2);

		float reflectivity = extras.x;
		float block_light = extras.z;
	
		lights[i] = light + color*pow(block_light, 4);
		colors[i] = color*(1.0 - pow(block_light, 4));

		if(i >= max_index) break;

		vec3 normal_cs = texelFetch(u_normals, ivec3(uxy, 0), 0).xyz;
		if(length(normal_cs) < 0.5) {
			break;
		}

		float r = (1. - reflectivity) * 3.1416 / 2.0;
		vec2 rand = hash23(vec3(ufp16vec2_as_vec2(pos.m), frx_renderSeconds));

		vec3 incidence_cs = dir_cs;

		if(dot(-incidence_cs, normal_cs) < 0) normal_cs *= -1;

		float x = (rand.x * 2.0 - 1.0) * r;

		vec3 new_normal_cs = rotation(
			x,
			normalize(cross(-incidence_cs, normal_cs))
		) * normal_cs;

		float cosa = dot(-incidence_cs, normal_cs);
		float angle = acos(cosa);
		float max_angle = 3.1416 / 2.0 - angle;

		float g = min(r, max_angle);
		if(x > g)
			cosa = g / x;
		else
			cosa = 1.0;
		
		max_angle = acos(cosa);
		float y = max_angle + (3.1416 - max_angle) * (rand.y * 2.0);

		normal_cs = rotation(y, normal_cs ) * new_normal_cs;

		dir_cs = normalize(
			reflect(
				incidence_cs,
				normal_cs
			)
		);

		dir_ws = cam_dir_to_win(pos_cs, dir_cs);
	}

	vec3 color = lights[i];

	while(--i >= 0) {
		color = color * colors[i] + lights[i];
	}

	out_color = vec4(
		(
			max(texelFetch(u_accum_0, ivec2(gl_FragCoord.xy), 0).rgb, vec3(0.0)) +
			pow3(color, 1.0 / 2.2)
		) / 2.,
		1.0
	);
}